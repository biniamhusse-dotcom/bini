# setup_local_ai.ps1
# Downloads and installs Ollama + a medical-grade LLM for the AI Clinical Assistant.
# Run this once, then start the assistant with: python assistant_server.py

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Bahmni AI Assistant - Local Setup"   -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check if Ollama is already installed ---
$ollamaPath = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaPath) {
    Write-Host "[OK] Ollama is already installed at $($ollamaPath.Source)" -ForegroundColor Green
} else {
    Write-Host "[1/4] Downloading Ollama installer..." -ForegroundColor Yellow
    $installer = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer -UseBasicParsing
    Write-Host "[2/4] Installing Ollama (may require admin)..." -ForegroundColor Yellow
    Start-Process -FilePath $installer -Wait
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "[OK] Ollama installed" -ForegroundColor Green
}

# --- 2. Start Ollama server ---
Write-Host "[3/4] Starting Ollama server..." -ForegroundColor Yellow
$ollamaProcess = Get-Process ollama -ErrorAction SilentlyContinue
if (-not $ollamaProcess) {
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 5
}
Write-Host "[OK] Ollama server running on http://localhost:11434" -ForegroundColor Green

# --- 3. Download the model ---
$model = "llama3.2:3b"
Write-Host "[4/4] Downloading $model (this may take a few minutes)..." -ForegroundColor Yellow
ollama pull $model
Write-Host "[OK] Model $model ready" -ForegroundColor Green

# --- 4. Install Python dependencies ---
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install openai requests python-dotenv flask gunicorn 2>$null
Write-Host "[OK] Python dependencies installed" -ForegroundColor Green

# --- 5. Print instructions ---
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup Complete!"                    -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the AI Clinical Assistant:" -ForegroundColor Cyan
Write-Host "  python assistant_server.py" -ForegroundColor White
Write-Host ""
Write-Host "Then open http://localhost:5050/ in your browser" -ForegroundColor White
Write-Host "Or click 'AI Assistant' in the Bahmni header bar" -ForegroundColor White
Write-Host ""
Write-Host "The assistant uses $model (runs locally, no API key needed)." -ForegroundColor Gray
Write-Host ""
