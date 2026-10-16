#!/usr/bin/env python3
"""
Bahmni-OpenAI Clinical Decision Support Middleware

Integrates an OpenAI Assistant with a Dockerized Bahmni (OpenMRS) EMR.
The AI can fetch patient encounter data via function calling, analyze it,
and return a clinical decision support summary.

Workflow:
  1. User sends a clinical query → OpenAI Assistant (Thread + Run)
  2. Assistant requests get_encounter_data(encounter_uuid)
  3. Middleware fetches the encounter from OpenMRS REST API
  4. Anonymizes PII (name, birthdate, address → age + gender only)
  5. Maps raw data into Observations, Investigations, Procedures
  6. Submits structured data back to OpenAI
  7. Assistant returns the clinical summary to the user

Requirements:
  pip install openai requests python-dotenv

Environment variables (or .env file):
  OPENAI_API_KEY          Your OpenAI API key
  OPENAI_ASSISTANT_ID     The Assistant ID from the OpenAI dashboard
  OPENMRS_BASE_URL        OpenMRS REST base URL (default: http://localhost/openmrs/ws/rest/v1)
  OPENMRS_USER            Basic Auth username (default: admin)
  OPENMRS_PASSWORD        Basic Auth password (default: Admin123)
  POLL_INTERVAL           Seconds between run status checks (default: 2)
  MAX_POLL_ATTEMPTS       Max polling retries before timeout (default: 300)
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

try:
    from openai import OpenAI, APIError as OpenAIAPIError
except ImportError:
    OpenAI = None  # type: ignore[assignment]
    OpenAIAPIError = Exception  # type: ignore[assignment,misc]

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv() -> None:
        pass


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_ASSISTANT_ID = os.getenv("OPENAI_ASSISTANT_ID", "")

LOCAL_AI_BASE_URL = os.getenv("LOCAL_AI_BASE_URL", "http://localhost:11434/v1")
LOCAL_AI_MODEL = os.getenv("LOCAL_AI_MODEL", "llama3.2:3b")
USE_LOCAL_AI = os.getenv("USE_LOCAL_AI", "").lower() in ("true", "1", "yes")

OPENMRS_BASE_URL = os.getenv(
    "OPENMRS_BASE_URL", "http://localhost/openmrs/ws/rest/v1"
)
OPENMRS_USER = os.getenv("OPENMRS_USER", "admin")
OPENMRS_PASSWORD = os.getenv("OPENMRS_PASSWORD", "Admin123")

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "2"))
MAX_POLL_ATTEMPTS = int(os.getenv("MAX_POLL_ATTEMPTS", "300"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("bahmni_middleware")


# ---------------------------------------------------------------------------
# Function Definition (paste into OpenAI Dashboard)
# ---------------------------------------------------------------------------

GET_ENCOUNTER_DATA_FN = {
    "name": "get_encounter_data",
    "description": (
        "Fetch a patient's clinical encounter data from the Bahmni EMR system. "
        "Returns structured observations (vitals / physical exam), investigations "
        "(lab results), and procedures. PII is stripped — only age, gender, and "
        "clinical data are returned."
    ),
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "encounter_uuid": {
                "type": "string",
                "description": "The UUID of the encounter to retrieve from OpenMRS.",
            }
        },
        "required": ["encounter_uuid"],
        "additionalProperties": False,
    },
}


# ===================================================================
#  OpenMRS Client
# ===================================================================

class OpenMRSClient:
    """HTTP client for the OpenMRS REST API v1."""

    def __init__(self, base_url: str, username: str, password: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self._session = requests.Session()
        self._session.auth = self.auth
        self._session.headers.update(
            {"Accept": "application/json", "Content-Type": "application/json"}
        )

    def get_encounter(self, encounter_uuid: str) -> Dict[str, Any]:
        """Fetch a full encounter record (v=full) by UUID."""
        url = f"{self.base_url}/encounter/{encounter_uuid}"
        log.info("GET %s?v=full", url)
        resp = self._session.get(url, params={"v": "full"}, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        self._session.close()


# ===================================================================
#  Anonymizer
# ===================================================================

class Anonymizer:
    """Strips PII from raw OpenMRS encounter data."""

    @staticmethod
    def _calculate_age(birthdate_str: str) -> Optional[int]:
        if not birthdate_str:
            return None
        try:
            bd = datetime.strptime(birthdate_str[:10], "%Y-%m-%d")
            today = datetime.today()
            return today.year - bd.year - (
                (today.month, today.day) < (bd.month, bd.day)
            )
        except (ValueError, TypeError):
            return None

    def anonymize_encounter(self, encounter: Dict[str, Any]) -> Dict[str, Any]:
        """
        Return a new dict with patient PII removed.

        Kept:   age, gender, encounter metadata, diagnoses, obs, orders.
        Stripped: patient name, birthdate, address, identifiers, attributes.
        """
        patient = encounter.get("patient", {}) or {}
        person = patient.get("person", {}) or {}

        age = self._calculate_age(person.get("birthdate", ""))

        provider_display = ""
        providers = encounter.get("encounterProviders") or []
        if providers:
            provider_display = (
                providers[0].get("provider", {}).get("display", "")
            )

        return {
            "gender": person.get("gender", ""),
            "age": age,
            "encounter_uuid": encounter.get("uuid", ""),
            "encounter_type": encounter.get("encounterType", {}).get("display", ""),
            "encounter_datetime": encounter.get("encounterDatetime", ""),
            "location": encounter.get("location", {}).get("display", ""),
            "provider": provider_display,
            "diagnoses": [
                {
                    "diagnosis": d.get("diagnosis", {}).get("display", ""),
                    "certainty": d.get("certainty", ""),
                    "order": d.get("order", ""),
                }
                for d in encounter.get("diagnoses") or []
            ],
            "obs": encounter.get("obs") or [],
            "orders": encounter.get("orders") or [],
        }


# ===================================================================
#  Data Mapper
# ===================================================================

class DataMapper:
    """
    Transforms raw anonymized encounter data into three clinical sections:

      - observations   Vitals, physical exam, signs/symptoms.
      - investigations Lab results (concept class = LabSet / Test).
      - procedures     Orders with orderType = Procedure / Surgery.
    """

    LAB_CONCEPT_CLASSES = frozenset({"LabSet", "Test", "Concept Details"})
    PROCEDURE_ORDER_TYPES = frozenset({"Procedure", "Surgery"})

    @staticmethod
    def _readable_value(obs: Dict[str, Any]) -> Any:
        value = obs.get("value")
        if isinstance(value, dict):
            return value.get("display", str(value))
        return value

    def map_encounter(self, data: Dict[str, Any]) -> Dict[str, Any]:
        observations: List[Dict[str, Any]] = []
        investigations: List[Dict[str, Any]] = []
        procedures: List[Dict[str, Any]] = []

        # --- orders → procedures ---
        for order in data.get("orders") or []:
            ot = order.get("orderType") or {}
            if ot.get("display") in self.PROCEDURE_ORDER_TYPES:
                procedures.append({
                    "concept": order.get("concept", {}).get("display", "Unknown"),
                    "order_type": ot.get("display", ""),
                    "status": order.get("status", ""),
                    "date_ordered": order.get("dateActivated", ""),
                    "instructions": order.get("instructions", ""),
                })

        # --- obs → observations / investigations ---
        for obs in data.get("obs") or []:
            concept = obs.get("concept") or {}
            cc = (concept.get("conceptClass") or {}).get("display", "")

            entry: Dict[str, Any] = {
                "concept": concept.get("display", "Unknown"),
                "value": self._readable_value(obs),
                "unit": concept.get("units", ""),
                "obs_datetime": obs.get("obsDatetime", ""),
            }

            members = obs.get("groupMembers")
            if members:
                entry["group_members"] = [
                    {
                        "concept": (m.get("concept") or {}).get("display", "Unknown"),
                        "value": self._readable_value(m),
                        "unit": (m.get("concept") or {}).get("units", ""),
                    }
                    for m in members
                ]

            if cc in self.LAB_CONCEPT_CLASSES:
                investigations.append(entry)
            else:
                observations.append(entry)

        return {
            "encounter_uuid": data.get("encounter_uuid", ""),
            "encounter_type": data.get("encounter_type", ""),
            "encounter_datetime": data.get("encounter_datetime", ""),
            "location": data.get("location", ""),
            "observations": observations,
            "investigations": investigations,
            "procedures": procedures,
        }


# ===================================================================
#  OpenAI Assistant Wrapper
# ===================================================================

class OpenAIAssistant:
    """Manages threads, runs, and tool-output submission."""

    def __init__(self, api_key: str, assistant_id: str) -> None:
        if OpenAI is None:
            raise ImportError(
                "The 'openai' package is required. Install it with: "
                "pip install openai"
            )
        self._client = OpenAI(api_key=api_key)
        self.assistant_id = assistant_id

    def create_thread(self) -> str:
        thread = self._client.beta.threads.create()
        log.info("Created thread %s", thread.id)
        return thread.id

    def add_message(self, thread_id: str, content: str, role: str = "user") -> None:
        self._client.beta.threads.messages.create(
            thread_id=thread_id, role=role, content=content
        )
        log.debug("Message added to thread %s", thread_id)

    def create_run(self, thread_id: str) -> str:
        run = self._client.beta.threads.runs.create(
            thread_id=thread_id, assistant_id=self.assistant_id
        )
        log.info("Created run %s on thread %s", run.id, thread_id)
        return run.id

    def get_run(self, thread_id: str, run_id: str):
        return self._client.beta.threads.runs.retrieve(
            thread_id=thread_id, run_id=run_id
        )

    def submit_tool_output(
        self, thread_id: str, run_id: str, tool_call_id: str, output: str
    ) -> None:
        self._client.beta.threads.runs.submit_tool_outputs(
            thread_id=thread_id,
            run_id=run_id,
            tool_outputs=[{"tool_call_id": tool_call_id, "output": output}],
        )
        log.info("Tool output submitted for call %s", tool_call_id)

    def get_last_assistant_message(self, thread_id: str) -> Optional[str]:
        messages = self._client.beta.threads.messages.list(thread_id=thread_id)
        for msg in messages:
            if msg.role == "assistant" and msg.content:
                return msg.content[0].text.value
        return None


# ===================================================================
#  Local AI Assistant (Ollama / any OpenAI-compatible local LLM)
# ===================================================================

LOCAL_AI_SYSTEM_PROMPT = (
    "You are a clinical decision support assistant integrated with the Bahmni EMR system.\n\n"
    "Your role is to help healthcare providers by:\n"
    "1. Analyzing patient encounter data (observations, lab results, procedures)\n"
    "2. Providing clinical decision support summaries\n"
    "3. Highlighting abnormal values and potential concerns\n"
    "4. Suggesting follow-up actions based on clinical guidelines\n\n"
    "CRITICAL RULES:\n"
    "- ONLY call the get_encounter_data function when the user has explicitly provided "
    "a valid encounter UUID in their message (a UUID looks like: a1b2c3d4-e5f6-7890-abcd-ef1234567890).\n"
    "- NEVER make up or guess encounter UUIDs. NEVER call get_encounter_data with a UUID "
    "that the user did not provide.\n"
    "- If the user sends a greeting (hi, hello, hey) or asks a general question without "
    "providing a UUID, respond conversationally and ask them to provide an encounter UUID.\n"
    "- If the user asks to analyze a patient but does not provide a UUID, ask them to "
    "provide the encounter UUID.\n\n"
    "Always base your recommendations on the data provided. If the data is insufficient, "
    "state what additional information is needed.\n\n"
    "Important: You are a clinical decision support tool, not a replacement for clinical "
    "judgment. Always remind users that your suggestions should be verified by qualified "
    "healthcare professionals."
)

LOCAL_AI_TOOL = {
    "type": "function",
    "function": {
        "name": "get_encounter_data",
        "description": (
            "Fetch a patient's clinical encounter data from the Bahmni EMR system. "
            "Returns observations (vitals, physical exam), investigations (lab results), "
            "and procedures. PII is stripped."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "encounter_uuid": {
                    "type": "string",
                    "description": "The UUID of the encounter to retrieve from OpenMRS.",
                }
            },
            "required": ["encounter_uuid"],
        },
    },
}


class LocalAIAssistant:
    """Uses a local LLM (Ollama, llama.cpp, etc.) via OpenAI-compatible chat API."""

    def __init__(self, base_url: str, model: str) -> None:
        if OpenAI is None:
            raise ImportError(
                "The 'openai' package is required. Install with: pip install openai"
            )
        self._client = OpenAI(api_key="ollama", base_url=base_url)
        self.model = model
        log.info("LocalAIAssistant: model=%s  base_url=%s", model, base_url)

    def process_message(
        self,
        user_message: str,
        openmrs: "OpenMRSClient",
        mapper: "DataMapper",
        anonymizer: "Anonymizer",
    ) -> str:
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": LOCAL_AI_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ]

        for iteration in range(5):
            log.info(
                "LocalAI iteration %d  messages=%d", iteration + 1, len(messages)
            )
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=[LOCAL_AI_TOOL],
            )
            choice = response.choices[0]

            if not choice.message.tool_calls:
                content = choice.message.content or "No response from local AI."
                # Check if LLM hallucinated a tool call as text content
                import re
                uuid_pattern = r'"encounter_uuid"\s*:\s*"([0-9a-fA-F-]{36})"'
                match = re.search(uuid_pattern, content)
                if match:
                    fake_uuid = match.group(1)
                    if not self._is_valid_uuid(fake_uuid):
                        return (
                            "I need a valid encounter UUID to analyze patient data. "
                            "Please provide a proper UUID (e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890). "
                            "You can find encounter UUIDs in the Bahmni patient encounter page."
                        )
                    messages.append({"role": "assistant", "content": content})
                    result = self._fetch_encounter(fake_uuid, openmrs, mapper, anonymizer)
                    messages.append({"role": "user", "content": "System: Function get_encounter_data returned:\n" + result})
                    continue
                return content

            messages.append(choice.message.model_dump())

            for tool_call in choice.message.tool_calls:
                if tool_call.function.name == "get_encounter_data":
                    args = json.loads(tool_call.function.arguments)
                    uuid = args.get("encounter_uuid", "")
                    result = self._fetch_encounter(uuid, openmrs, mapper, anonymizer)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": result,
                        }
                    )

        return "Analysis completed but response was incomplete."

    @staticmethod
    def _is_valid_uuid(value: str) -> bool:
        import re
        pattern = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        return bool(re.match(pattern, value))

    @staticmethod
    def _fetch_encounter(
        encounter_uuid: str,
        openmrs: "OpenMRSClient",
        mapper: "DataMapper",
        anonymizer: "Anonymizer",
    ) -> str:
        log.info("LocalAI: get_encounter_data(uuid=%s)", encounter_uuid)
        if not encounter_uuid or not LocalAIAssistant._is_valid_uuid(encounter_uuid):
            return json.dumps({
                "error": f"Invalid encounter UUID format: '{encounter_uuid}'. "
                "Please provide a valid UUID (e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890)."
            })
        try:
            raw = openmrs.get_encounter(encounter_uuid)
            clean = anonymizer.anonymize_encounter(raw)
            structured = mapper.map_encounter(clean)
            return json.dumps(structured, indent=2, default=str)
        except requests.HTTPError as exc:
            return json.dumps({"error": f"OpenMRS API error: {exc}"})
        except Exception as exc:
            return json.dumps({"error": f"Internal error: {exc}"})


# ===================================================================
#  Middleware Orchestrator
# ===================================================================

class Middleware:
    """
    Orchestrates the full cycle. Works with both OpenAI Assistant and LocalAI.
    """

    def __init__(
        self,
        assistant,
        openmrs: OpenMRSClient,
        mapper: DataMapper,
        anonymizer: Anonymizer,
    ) -> None:
        self._assistant = assistant
        self._openmrs = openmrs
        self._mapper = mapper
        self._anonymizer = anonymizer

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_message(
        self, user_message: str, thread_id: Optional[str] = None
    ) -> str:
        if isinstance(self._assistant, LocalAIAssistant):
            return self._assistant.process_message(
                user_message, self._openmrs, self._mapper, self._anonymizer
            )
        return self._process_openai(user_message, thread_id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _process_openai(self, user_message: str, thread_id: Optional[str]) -> str:
        if thread_id is None:
            thread_id = self._assistant.create_thread()

        self._assistant.add_message(thread_id, user_message)
        run_id = self._assistant.create_run(thread_id)
        status = self._poll_run_until_done(thread_id, run_id)

        if status == "completed":
            response = self._assistant.get_last_assistant_message(thread_id)
            return response or "No assistant response."
        else:
            return f"Run ended with status: {status}"

    def _poll_run_until_done(self, thread_id: str, run_id: str) -> str:
        for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
            run = self._assistant.get_run(thread_id, run_id)

            if run.status == "completed":
                log.info("Run %s completed (attempt %d)", run_id, attempt)
                return "completed"

            if run.status == "requires_action":
                self._handle_requires_action(thread_id, run)
                # continue polling — run is still active after submission

            elif run.status in ("failed", "cancelled", "expired"):
                log.error("Run %s terminated: %s", run_id, run.status)
                if run.last_error:
                    log.error("Run error: %s", run.last_error)
                return run.status

            if attempt % 10 == 0:
                log.info(
                    "Run %s status=%s (attempt %d/%d)",
                    run_id, run.status, attempt, MAX_POLL_ATTEMPTS,
                )

            time.sleep(POLL_INTERVAL)

        log.error("Run %s timed out after %d attempts", run_id, MAX_POLL_ATTEMPTS)
        return "timeout"

    def _handle_requires_action(self, thread_id: str, run) -> None:
        required_action = run.required_action
        if not required_action:
            return

        for tool_call in required_action.submit_tool_outputs.tool_calls:
            if tool_call.function.name == "get_encounter_data":
                args = json.loads(tool_call.function.arguments)
                output = self._execute_get_encounter_data(
                    args.get("encounter_uuid", "")
                )
                self._assistant.submit_tool_output(
                    thread_id=thread_id,
                    run_id=run.id,
                    tool_call_id=tool_call.id,
                    output=output,
                )

    def _execute_get_encounter_data(self, encounter_uuid: str) -> str:
        log.info("Executing get_encounter_data(uuid=%s)", encounter_uuid)
        import re
        pattern = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        if not encounter_uuid or not re.match(pattern, encounter_uuid):
            return json.dumps({
                "error": f"Invalid encounter UUID format: '{encounter_uuid}'. "
                "Please provide a valid UUID (e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890)."
            })
        try:
            raw = self._openmrs.get_encounter(encounter_uuid)
            clean = self._anonymizer.anonymize_encounter(raw)
            structured = self._mapper.map_encounter(clean)
            return json.dumps(structured, indent=2, default=str)
        except requests.HTTPError as exc:
            log.error("OpenMRS HTTP error: %s", exc)
            return json.dumps({"error": f"OpenMRS API error: {exc}"})
        except Exception as exc:
            log.exception("Unexpected error in get_encounter_data")
            return json.dumps({"error": f"Internal error: {exc}"})


# ===================================================================
#  CLI Entry Point
# ===================================================================

def main() -> None:
    openmrs = OpenMRSClient(OPENMRS_BASE_URL, OPENMRS_USER, OPENMRS_PASSWORD)
    mapper = DataMapper()
    anonymizer = Anonymizer()

    if USE_LOCAL_AI or (not OPENAI_API_KEY and not OPENAI_ASSISTANT_ID):
        log.info("Using LOCAL AI (Ollama) — model=%s", LOCAL_AI_MODEL)
        assistant = LocalAIAssistant(LOCAL_AI_BASE_URL, LOCAL_AI_MODEL)
    else:
        log.info("Using OpenAI Assistant — id=%s", OPENAI_ASSISTANT_ID)
        assistant = OpenAIAssistant(OPENAI_API_KEY, OPENAI_ASSISTANT_ID)

    middleware = Middleware(assistant, openmrs, mapper, anonymizer)

    print("=" * 64)
    print("  Bahmni Clinical Decision Support Middleware")
    print("=" * 64)
    print(f"  Mode: {'LOCAL AI (Ollama)' if isinstance(assistant, LocalAIAssistant) else 'OpenAI Assistant'}")
    print()
    print("Function definition (paste into OpenAI Dashboard):")
    print("-" * 64)
    print(json.dumps(GET_ENCOUNTER_DATA_FN, indent=2))
    print("-" * 64)
    print()

    # --- Mode dispatch ---
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        log.info("Single-shot mode: %s", query[:80])
        response = middleware.process_message(query)
        print("\nAssistant:\n")
        print(response)
        print()
    else:
        thread_id = (
            assistant.create_thread()
            if hasattr(assistant, "create_thread")
            else None
        )
        if thread_id:
            print(f"Thread ID: {thread_id}")
        print("Type your clinical queries below (or 'quit' to exit).\n")

        while True:
            try:
                text = input("You: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break

            if not text:
                continue
            if text.lower() in ("quit", "exit", "q"):
                break

            print()
            reply = middleware.process_message(text, thread_id)
            print(f"\nAssistant:\n{reply}\n")


if __name__ == "__main__":
    main()
