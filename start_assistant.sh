#!/bin/bash
# start_assistant.sh — One-click startup for the AI Clinical Assistant.
# Works on Ubuntu, macOS, and Windows (Git Bash / WSL).
#
# Usage:
#   ./start_assistant.sh              # Start ollama + assistant containers
#   ./start_assistant.sh --rebuild    # Rebuild the assistant image first
#   ./start_assistant.sh --pull       # Pull Ollama image from Docker Hub first
#   ./start_assistant.sh --stop       # Stop assistant services
#   ./start_assistant.sh --status     # Show status
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Bahmni stack running (openmrs must be up)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BAHMNI_DIR="$SCRIPT_DIR/bahmni-docker/bahmni-standard"
MODEL="${LOCAL_AI_MODEL:-llama3.2:3b}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Check Docker
if ! command -v docker &>/dev/null; then
    err "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
    err "Docker Compose is not installed."
    exit 1
fi

# Navigate to bahmni-standard directory
cd "$BAHMNI_DIR" || { err "Cannot find $BAHMNI_DIR"; exit 1; }

case "${1:-}" in
    --stop)
        info "Stopping AI assistant services..."
        docker compose --profile bahmni-standard stop assistant ollama ollama-init
        ok "Assistant services stopped."
        exit 0
        ;;
    --status)
        info "Checking AI assistant services..."
        docker compose --profile bahmni-standard ps assistant ollama ollama-init 2>/dev/null || true
        echo ""
        info "Testing API endpoint..."
        if curl -sf http://localhost:5050/api/status &>/dev/null; then
            ok "Assistant API is responding at http://localhost:5050"
        elif curl -sf http://localhost:8186/assistant/api/status &>/dev/null; then
            ok "Assistant API is responding via proxy at http://localhost:8186/assistant"
        else
            warn "Assistant API is not responding"
        fi
        exit 0
        ;;
    --rebuild)
        info "Rebuilding assistant image..."
        docker compose --profile bahmni-standard build --no-cache assistant
        ok "Assistant image rebuilt."
        ;;
    --pull)
        info "Pulling Ollama image from Docker Hub..."
        docker pull ollama/ollama:latest
        ok "Ollama image pulled."
        ;;
    --help|-h)
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  (none)      Start ollama + assistant containers"
        echo "  --rebuild   Rebuild the assistant Docker image"
        echo "  --pull      Pull Ollama image from Docker Hub"
        echo "  --stop      Stop assistant services"
        echo "  --status    Show service status"
        echo "  --help      Show this help"
        echo ""
        echo "Environment variables:"
        echo "  LOCAL_AI_MODEL   LLM model to use (default: llama3.2:3b)"
        echo "  OPENAI_API_KEY   OpenAI API key (optional, for cloud mode)"
        exit 0
        ;;
esac

# --- Check if OpenMRS is running ---
info "Checking if OpenMRS is running..."
if ! docker ps --format '{{.Names}}' | grep -q openmrs; then
    warn "OpenMRS container is not running."
    warn "Start Bahmni first: cd bahmni-docker/bahmni-standard && bash ../run-bahmni.sh"
    warn "Continuing anyway — assistant will start but OpenMRS queries will fail."
fi

# --- Start Ollama + Assistant ---
info "Starting Ollama and AI Assistant containers..."
docker compose --profile bahmni-standard up -d ollama assistant

# --- Wait for Ollama to be ready ---
info "Waiting for Ollama to be ready..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
        ok "Ollama is ready"
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

# --- Pull model if not already present ---
if docker compose --profile bahmni-standard exec -T ollama ollama list 2>/dev/null | grep -q "$MODEL"; then
    ok "Model $MODEL already available"
else
    info "Downloading model $MODEL (this may take several minutes)..."
    docker compose --profile bahmni-standard exec -T ollama ollama pull "$MODEL"
    ok "Model $MODEL ready"
fi

# --- Start ollama-init for model auto-pull (background) ---
info "Starting model auto-pull service (ollama-init)..."
docker compose --profile bahmni-standard up -d ollama-init 2>/dev/null || true

# --- Wait for assistant to be ready ---
info "Waiting for assistant API to be ready..."
for i in $(seq 1 15); do
    if curl -sf http://localhost:5050/api/status &>/dev/null; then
        ok "Assistant API is ready!"
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

# --- Restart proxy to pick up config ---
info "Restarting proxy to pick up assistant route..."
docker compose restart proxy 2>/dev/null || \
    docker restart bahmni-standard-proxy-1 2>/dev/null || \
    warn "Could not restart proxy — you may need to restart it manually"

# --- Print status ---
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  AI Clinical Assistant is Running!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "  Direct:   http://localhost:5050/"
echo "  Proxy:    http://localhost:8186/assistant/"
echo "  Bahmni:   http://localhost:8186/ (click 'AI Assistant' in header)"
echo ""
echo "  Model:    $MODEL"
echo "  Ollama:   http://localhost:11434"
echo ""
echo "  To stop:  $0 --stop"
echo "  Status:   $0 --status"
echo ""
