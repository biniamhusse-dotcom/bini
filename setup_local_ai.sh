#!/bin/bash
# setup_local_ai.sh
# Installs Ollama + medical-grade LLM for the AI Clinical Assistant on Ubuntu/Debian.
# Run this once on the host, then use docker compose to start the stack.

set -e

echo ""
echo "======================================"
echo "  Bahmni AI Assistant - Local Setup"
echo "======================================"
echo ""

MODEL="${1:-llama3.2:3b}"

# --- 1. Check if Ollama is already installed ---
if command -v ollama &>/dev/null; then
    echo "[OK] Ollama is already installed at $(which ollama)"
else
    echo "[1/4] Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "[OK] Ollama installed"
fi

# --- 2. Start Ollama server if not running ---
if pgrep -x ollama &>/dev/null; then
    echo "[OK] Ollama server already running"
else
    echo "[2/4] Starting Ollama server..."
    nohup ollama serve &>/dev/null &
    sleep 3
    echo "[OK] Ollama server started on http://localhost:11434"
fi

# --- 3. Download the model ---
echo "[3/4] Pulling $model (this may take a few minutes)..."
ollama pull "$MODEL"
echo "[OK] Model $MODEL ready"

# --- 4. Verify ---
echo "[4/4] Verifying setup..."
if curl -s http://localhost:11434/api/tags | grep -q "$MODEL"; then
    echo "[OK] Model verified and ready"
else
    echo "[WARN] Model may still be loading. Check with: ollama list"
fi

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "The Ollama API is running at: http://localhost:11434"
echo "Model: $MODEL"
echo ""
echo "To start the AI Clinical Assistant:"
echo ""
echo "  Option A (Docker - recommended):"
echo "    cd bahmni-docker/bahmni-standard"
echo "    docker compose --profile bahmni-standard up -d ollama assistant"
echo ""
echo "  Option B (local Python):"
echo "    cd $HOME/emr  # or wherever the repo is cloned"
echo "    python assistant_server.py"
echo ""
echo "Then open http://localhost:8186/ and click 'AI Assistant' in the header"
echo "Or go directly to http://localhost:5050/"
echo ""
