#!/usr/bin/env python3
"""
Assistant Server — Flask-based HTTP API + popup frontend for the
Bahmni-OpenAI Clinical Decision Support Middleware.

Run:
    pip install flask
    python assistant_server.py

Then open http://localhost:5050 in a browser, or embed the popup
URL in Bahmni as a custom link.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import uuid
from threading import Lock
from typing import Dict, Optional

from flask import Flask, jsonify, request, render_template_string

# Reuse the middleware modules
from bahmni_openai_middleware import (
    OPENAI_API_KEY,
    OPENAI_ASSISTANT_ID,
    OPENMRS_BASE_URL,
    OPENMRS_USER,
    OPENMRS_PASSWORD,
    LOCAL_AI_BASE_URL,
    LOCAL_AI_MODEL,
    USE_LOCAL_AI,
    GET_ENCOUNTER_DATA_FN,
    OpenMRSClient,
    DataMapper,
    Anonymizer,
    OpenAIAssistant,
    LocalAIAssistant,
    Middleware,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("assistant_server")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=None)

# ---------------------------------------------------------------------------
# Shared middleware instances (lazy-init)
# ---------------------------------------------------------------------------

_mw: Optional[Middleware] = None
_mw_lock = Lock()


def get_middleware() -> Middleware:
    global _mw
    if _mw is None:
        with _mw_lock:
            if _mw is None:
                openmrs = OpenMRSClient(OPENMRS_BASE_URL, OPENMRS_USER, OPENMRS_PASSWORD)
                mapper = DataMapper()
                anonymizer = Anonymizer()

                if USE_LOCAL_AI or (not OPENAI_API_KEY and not OPENAI_ASSISTANT_ID):
                    assistant = LocalAIAssistant(LOCAL_AI_BASE_URL, LOCAL_AI_MODEL)
                else:
                    assistant = OpenAIAssistant(OPENAI_API_KEY, OPENAI_ASSISTANT_ID)

                _mw = Middleware(assistant, openmrs, mapper, anonymizer)
                log.info("Middleware initialized (%s)", type(assistant).__name__)
    return _mw


# ---------------------------------------------------------------------------
# Thread sessions (in-memory; replace with Redis for production)
# ---------------------------------------------------------------------------

class SessionStore:
    def __init__(self) -> None:
        self._store: Dict[str, str] = {}  # session_id -> thread_id (or empty for local AI)
        self._lock = Lock()

    def create(self, session_id: str) -> str:
        mw = get_middleware()
        if isinstance(mw._assistant, LocalAIAssistant):
            with self._lock:
                self._store[session_id] = ""
            return ""
        thread_id = mw._assistant.create_thread()
        with self._lock:
            self._store[session_id] = thread_id
        return thread_id

    def get_thread(self, session_id: str) -> Optional[str]:
        with self._lock:
            return self._store.get(session_id)

    def get_or_create(self, session_id: str) -> str:
        thread = self.get_thread(session_id)
        if thread:
            return thread
        return self.create(session_id)


sessions = SessionStore()


# ===================================================================
#  API Routes
# ===================================================================

@app.route("/api/status", methods=["GET"])
def status():
    try:
        mw = get_middleware()
        is_local = isinstance(mw._assistant, LocalAIAssistant)
        ok = True
    except Exception as e:
        ok = False
        is_local = False
    return jsonify({
        "ok": ok,
        "mode": "local" if ok and is_local else "openai",
        "model": LOCAL_AI_MODEL if ok and is_local else OPENAI_ASSISTANT_ID,
        "openmrs_base": OPENMRS_BASE_URL,
    })


@app.route("/api/encounter/recent", methods=["GET"])
def get_recent_encounter():
    """Get the most recent encounter UUID for a patient."""
    patient_uuid = request.args.get("patient_uuid")
    if not patient_uuid:
        return jsonify({"error": "Missing patient_uuid parameter"}), 400

    try:
        mw = get_middleware()
        url = f"{OPENMRS_BASE_URL}/encounter"
        params = {
            "patient": patient_uuid,
            "v": "custom:(uuid,encounterDatetime,encounterType:(display),location:(display))",
            "order": "desc",
            "limit": 1,
        }
        resp = mw._openmrs._session.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if not results:
            return jsonify({"error": "No encounters found for this patient", "patient_uuid": patient_uuid}), 404
        encounter = results[0]
        return jsonify({
            "encounter_uuid": encounter["uuid"],
            "encounter_datetime": encounter.get("encounterDatetime", ""),
            "encounter_type": (encounter.get("encounterType") or {}).get("display", ""),
            "location": (encounter.get("location") or {}).get("display", ""),
        })
    except Exception as e:
        log.error("Error fetching recent encounter: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/thread", methods=["POST"])
def create_thread():
    """Create a new conversation thread. Returns session_id."""
    session_id = str(uuid.uuid4())
    sessions.create(session_id)
    return jsonify({"session_id": session_id, "thread_id": sessions.get_thread(session_id)})


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Send a message and get the assistant's response.

    Request JSON:
      { "message": "...", "session_id": "..." }

    The session_id is optional — if omitted, a new thread is created.
    """
    data = request.get_json(force=True)
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' field"}), 400

    message = data["message"]
    session_id = data.get("session_id")

    try:
        mw = get_middleware()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    if session_id and sessions.get_thread(session_id) is not None:
        thread_id = sessions.get_thread(session_id)
    else:
        session_id = str(uuid.uuid4())
        thread_id = sessions.create(session_id)

    try:
        response = mw.process_message(message, thread_id or None)
    except Exception as e:
        log.error("Chat error: %s", e)
        return jsonify({"error": f"AI backend error: {e}", "session_id": session_id})

    return jsonify({"response": response, "session_id": session_id})


# ===================================================================
#  Popup frontend (single-page HTML)
# ===================================================================

POPUP_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AI Clinical Assistant</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; background: #f5f5f5; color: #333; }
  a { color: #007bff; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .header {
    background: linear-gradient(135deg, #004d73 0%, #0073aa 100%);
    color: #fff; padding: 12px 16px; display: flex; align-items: center; gap: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: relative; z-index: 10;
  }
  .header h1 { font-size: 16px; font-weight: 600; flex: 1; }
  .header .fa { font-size: 20px; }
  .header .subtitle { font-size: 11px; opacity: 0.8; font-weight: 400; }

  /* Config bar */
  .config-bar {
    background: #e9ecef; padding: 8px 16px; display: flex; align-items: center;
    gap: 8px; font-size: 12px; border-bottom: 1px solid #ccc; flex-wrap: wrap;
  }
  .config-bar label { font-weight: 600; white-space: nowrap; }
  .config-bar input[type="text"] {
    flex: 1; min-width: 180px; padding: 4px 8px; border: 1px solid #ccc;
    border-radius: 3px; font-size: 12px;
  }
  .config-bar button {
    padding: 4px 12px; border: none; border-radius: 3px; cursor: pointer;
    font-size: 12px; font-weight: 600;
  }
  .btn-connect { background: #28a745; color: #fff; }
  .btn-connect:disabled { background: #aaa; cursor: not-allowed; }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
  .status-dot.online { background: #28a745; }
  .status-dot.offline { background: #dc3545; }

  /* Chat area */
  .chat-container { display: flex; flex-direction: column; height: calc(100vh - 100px); }
  .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .message { max-width: 80%; padding: 10px 14px; border-radius: 12px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
  .message.user { align-self: flex-end; background: #0073aa; color: #fff; border-bottom-right-radius: 4px; }
  .message.assistant { align-self: flex-start; background: #fff; border: 1px solid #ddd; border-bottom-left-radius: 4px; }
  .message.system { align-self: center; background: #fff3cd; color: #856404; font-size: 12px; border-radius: 6px; padding: 6px 12px; }
  .message .msg-label { font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: 0.6; margin-bottom: 4px; display: block; }
  .message.assistant .msg-label { color: #666; }
  .message.user .msg-label { color: rgba(255,255,255,0.7); }
  .message .timestamp { font-size: 10px; opacity: 0.5; margin-top: 4px; display: block; text-align: right; }
  .typing-indicator { align-self: flex-start; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 10px 16px; display: none; border-bottom-left-radius: 4px; }
  .typing-indicator span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #999; margin: 0 2px; animation: blink 1.4s infinite both; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

  /* Input area */
  .input-area { display: flex; gap: 8px; padding: 12px 16px; background: #fff; border-top: 1px solid #ddd; }
  .input-area textarea {
    flex: 1; border: 1px solid #ccc; border-radius: 8px; padding: 10px 12px;
    font-family: inherit; font-size: 13px; resize: none; outline: none; min-height: 42px;
    max-height: 120px; line-height: 1.4;
  }
  .input-area textarea:focus { border-color: #0073aa; }
  .input-area button {
    background: #0073aa; color: #fff; border: none; border-radius: 8px;
    width: 42px; height: 42px; cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; flex-shrink: 0;
  }
  .input-area button:hover { background: #004d73; }
  .input-area button:disabled { background: #ccc; cursor: not-allowed; }

  /* Scrollbar */
  .messages::-webkit-scrollbar { width: 6px; }
  .messages::-webkit-scrollbar-track { background: transparent; }
  .messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

  /* Encounter UUID suggestions */
  .uuid-hint { font-size: 11px; color: #666; padding: 0 16px 4px; display: flex; gap: 4px; flex-wrap: wrap; }
  .uuid-hint code { background: #e9ecef; padding: 1px 4px; border-radius: 2px; cursor: pointer; font-size: 10px; }
  .uuid-hint code:hover { background: #0073aa; color: #fff; }

  /* Markdown-like formatting in responses */
  .message.assistant strong { font-weight: 600; }
  .message.assistant ul, .message.assistant ol { padding-left: 20px; margin: 6px 0; }
  .message.assistant li { margin: 2px 0; }
  .message.assistant h3, .message.assistant h4 { margin: 8px 0 4px; }
  .message.assistant hr { margin: 8px 0; border: none; border-top: 1px solid #eee; }
  .message.assistant code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  .message.assistant table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 12px; }
  .message.assistant th, .message.assistant td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
  .message.assistant th { background: #f5f5f5; font-weight: 600; }
</style>
</head>
<body>

<div class="header">
  <i class="fa fa-stethoscope"></i>
  <div>
    <h1>AI Clinical Assistant</h1>
    <div class="subtitle">Clinical Decision Support · Bahmni EMR Integration</div>
  </div>
</div>

<div class="config-bar">
  <span class="status-dot offline" id="statusDot"></span>
  <span id="statusText">Disconnected</span>
  <label>Server:</label>
  <input type="text" id="serverUrl" value="" placeholder="http://localhost:5050">
  <button class="btn-connect" id="btnConnect" onclick="connect()"><i class="fa fa-link"></i> Connect</button>
  <button onclick="newThread()" style="background:#6c757d;color:#fff"><i class="fa fa-plus"></i> New Chat</button>
</div>

<div class="uuid-hint" id="uuidHint">
  <span>Encounter UUID quick-paste:</span>
</div>

<div class="chat-container">
  <div class="messages" id="messages">
    <div class="message system">
      <span class="msg-label">Info</span>
      Connect to the server and start a clinical query.<br>
      The assistant will request an encounter UUID when needed — paste it above or type it in your message.
    </div>
  </div>
  <div class="typing-indicator" id="typingIndicator">
    <span></span><span></span><span></span>
  </div>
  <div class="input-area">
    <textarea id="messageInput" rows="1" placeholder="Type your clinical question..." onkeydown="onInputKeydown(event)"></textarea>
    <button id="sendBtn" onclick="sendMessage()" disabled><i class="fa fa-send"></i></button>
  </div>
</div>

<script>
let sessionId = null;
let connected = false;
let serverBase = "";

function $(id) { return document.getElementById(id); }

function log(msg) { console.log("[Assistant]", msg); }

async function connect() {
  serverBase = $("serverUrl").value.replace(/\/+$/, "");
  if (!serverBase) {
    $("statusText").textContent = "Enter server URL";
    return;
  }
  $("btnConnect").disabled = true;
  $("btnConnect").innerHTML = '<i class="fa fa-spinner fa-spin"></i> Connecting...';
  try {
    const resp = await fetch(serverBase + "/api/status");
    const data = await resp.json();
    if (data.ok) {
      connected = true;
      $("statusDot").className = "status-dot online";
      $("statusText").textContent = "Connected · " + data.mode + " · " + (data.model || "").slice(0, 20);
      $("btnConnect").innerHTML = '<i class="fa fa-check"></i> Connected';
      $("btnConnect").style.background = "#28a745";
      $("sendBtn").disabled = false;
      $("messageInput").focus();
      addSystemMessage("Connected to server. Mode: " + data.mode + ", Model: " + (data.model || "unknown"));
      // Load template UUIDs
      $("uuidHint").innerHTML = '<span>Encounter UUID quick-paste:</span> <code onclick="pasteUuid(this.textContent)">e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890</code> <code onclick="newThread()">[New Chat]</code>';
      // Create session
      await newThread();
    } else {
      throw new Error("Server not ready");
    }
  } catch (e) {
    connected = false;
    $("statusDot").className = "status-dot offline";
    $("statusText").textContent = "Connection failed: " + e.message;
    $("btnConnect").innerHTML = '<i class="fa fa-link"></i> Retry';
    $("btnConnect").disabled = false;
    $("sendBtn").disabled = true;
  }
}

async function newThread() {
  if (!connected) return;
  try {
    const resp = await fetch(serverBase + "/api/thread", { method: "POST" });
    const data = await resp.json();
    sessionId = data.session_id;
    $("messages").innerHTML = "";
    addSystemMessage("New conversation started.");
    log("New thread: " + data.thread_id);
  } catch (e) {
    addSystemMessage("Error creating thread: " + e.message);
  }
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "message " + role;
  const label = document.createElement("span");
  label.className = "msg-label";
  label.textContent = role === "user" ? "You" : "Assistant";
  div.appendChild(label);
  const content = document.createElement("div");
  content.innerHTML = formatText(text);
  div.appendChild(content);
  const ts = document.createElement("span");
  ts.className = "timestamp";
  ts.textContent = new Date().toLocaleTimeString();
  div.appendChild(ts);
  $("messages").appendChild(div);
  scrollToBottom();
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "message system";
  const label = document.createElement("span");
  label.className = "msg-label";
  label.textContent = "System";
  div.appendChild(label);
  const content = document.createElement("div");
  content.textContent = text;
  div.appendChild(content);
  $("messages").appendChild(div);
  scrollToBottom();
}

function formatText(text) {
  if (!text) return "";
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Simple markdown-like formatting
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function scrollToBottom() {
  const el = $("messages");
  el.scrollTop = el.scrollHeight;
}

function showTyping(show) {
  $("typingIndicator").style.display = show ? "block" : "none";
  scrollToBottom();
}

async function sendMessage() {
  const input = $("messageInput");
  const text = input.value.trim();
  if (!text || !connected || !sessionId) return;

  input.value = "";
  input.style.height = "auto";
  $("sendBtn").disabled = true;

  addMessage("user", text);
  showTyping(true);

  try {
    const resp = await fetch(serverBase + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, session_id: sessionId }),
    });
    const data = await resp.json();
    showTyping(false);
    if (data.response) {
      addMessage("assistant", data.response);
    } else if (data.error) {
      addSystemMessage("Error: " + data.error);
    }
    if (data.session_id) sessionId = data.session_id;
  } catch (e) {
    showTyping(false);
    addSystemMessage("Request failed: " + e.message);
  }

  $("sendBtn").disabled = false;
  input.focus();
}

function onInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-resize
  const el = e.target;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function pasteUuid(uuid) {
  const input = $("messageInput");
  // Clean up the example text
  const clean = uuid.replace(/^e\.g\.\s*/i, "").trim();
  input.value = "Analyze encounter " + clean;
  input.focus();
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}

// Auto-connect on load — try multiple URLs to find the assistant backend
// Detect patient context from URL params OR from the opener window (Bahmni)
(function init() {
  const params = new URLSearchParams(window.location.search);
  var patientUuid = params.get("patient_uuid");
  var encounterUuid = params.get("encounter_uuid");

  // If no URL params, try to read from opener window (Bahmni)
  if (!patientUuid && window.opener) {
    try {
      var openerUrl = window.opener.location.href;
      var m = openerUrl.match(/patient\/([a-f0-9A-F]{8}-[a-f0-9A-F]{4}-[a-f0-9A-F]{4}-[a-f0-9A-F]{4}-[a-f0-9A-F]{12})/);
      if (m) patientUuid = m[1];
    } catch(e) { /* cross-origin or other error */ }
  }

  // Build candidate URLs: try direct port, proxy /assistant, then current origin
  const candidates = [
    "http://localhost:5050",                  // Direct Flask server
    window.location.origin + "/assistant",     // Via Bahmni proxy
  ];
  $("serverUrl").value = candidates[0];
  // Try auto-connect with fallback
  async function tryAutoConnect() {
    for (const url of candidates) {
      $("serverUrl").value = url;
      try {
        const resp = await fetch(url + "/api/status", { signal: AbortSignal.timeout(3000) });
        const data = await resp.json();
        if (data.ok) {
          await connect();
          // If we have patient context, auto-load it
          if (patientUuid || encounterUuid) {
            await loadPatientContext(url, patientUuid, encounterUuid);
          }
          return;
        }
      } catch(e) { /* try next */ }
    }
    // All failed — leave UI ready for manual connect
  }

  async function loadPatientContext(baseUrl, patientUuid, encounterUuid) {
    try {
      let encUuid = encounterUuid;
      let patientInfo = "";

      // If no encounter UUID but have patient UUID, fetch recent encounter
      if (!encUuid && patientUuid) {
        addSystemMessage("Fetching recent encounter for patient...");
        const resp = await fetch(baseUrl + "/api/encounter/recent?patient_uuid=" + patientUuid);
        const data = await resp.json();
        if (data.encounter_uuid) {
          encUuid = data.encounter_uuid;
          patientInfo = "Patient: " + patientUuid.substring(0, 8) + "...";
          addSystemMessage("Found encounter: " + data.encounter_type + " (" + data.encounter_datetime + ")");
        } else {
          addSystemMessage("No encounters found for this patient. You can provide an encounter UUID manually.");
          return;
        }
      } else if (encUuid) {
        patientInfo = "Encounter: " + encUuid.substring(0, 8) + "...";
      }

      // Auto-analyze the encounter
      if (encUuid) {
        addSystemMessage("Auto-loading encounter data...");
        const chatResp = await fetch(baseUrl + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Analyze encounter " + encUuid,
            session_id: sessionId
          }),
        });
        const chatData = await chatResp.json();
        if (chatData.response) {
          addMessage("assistant", chatData.response);
        } else if (chatData.error) {
          addSystemMessage("Error: " + chatData.error);
        }
        if (chatData.session_id) sessionId = chatData.session_id;
      }
    } catch (e) {
      addSystemMessage("Error loading patient context: " + e.message);
    }
  }

  setTimeout(tryAutoConnect, 500);
})();
</script>
</body>
</html>
"""


@app.route("/", methods=["GET"])
def popup():
    return render_template_string(POPUP_HTML)


# ===================================================================
#  Main
# ===================================================================

def main():
    port = int(os.getenv("ASSISTANT_PORT", "5050"))
    host = os.getenv("ASSISTANT_HOST", "0.0.0.0")

    print("=" * 60)
    print("  Bahmni ↔ OpenAI Assistant Server")
    print("=" * 60)
    print()
    print(f"  Popup UI:    http://localhost:{port}/")
    print(f"  API status:  http://localhost:{port}/api/status")
    print(f"  API chat:    POST http://localhost:{port}/api/chat")
    print()
    print("  Paste this function into your OpenAI Assistant dashboard:")
    print(json.dumps(GET_ENCOUNTER_DATA_FN, indent=2))
    print()

    if USE_LOCAL_AI or (not OPENAI_API_KEY and not OPENAI_ASSISTANT_ID):
        print(f"  Mode: LOCAL AI (Ollama) — model={LOCAL_AI_MODEL}")
    else:
        if not OPENAI_API_KEY:
            print("  *** ERROR: OPENAI_API_KEY is not set ***")
            sys.exit(1)
        if not OPENAI_ASSISTANT_ID:
            print("  *** ERROR: OPENAI_ASSISTANT_ID is not set ***")
            sys.exit(1)
        print(f"  Mode: OpenAI Assistant — id={OPENAI_ASSISTANT_ID}")

    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    main()
