@echo off
REM start_assistant.cmd — One-click startup for the AI Clinical Assistant on Windows.
REM Usage:
REM   start_assistant.cmd              Start ollama + assistant containers
REM   start_assistant.cmd --stop       Stop assistant services
REM   start_assistant.cmd --status     Show status

setlocal enabledelayedexpansion

set BAHMNI_DIR=%~dp0bahmni-docker\bahmni-standard
set MODEL=%LOCAL_AI_MODEL%
if "%MODEL%"=="" set MODEL=llama3.2:3b

echo.
echo ======================================
echo   Bahmni AI Assistant Startup
echo ======================================
echo.

REM Check Docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

cd /d "%BAHMNI_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Cannot find %BAHMNI_DIR%
    exit /b 1
)

if "%1"=="--stop" (
    echo [INFO] Stopping AI assistant services...
    docker compose --profile bahmni-standard stop assistant ollama ollama-init
    echo [OK] Assistant services stopped.
    exit /b 0
)

if "%1"=="--status" (
    echo [INFO] Checking AI assistant services...
    docker compose --profile bahmni-standard ps assistant ollama ollama-init
    echo.
    echo [INFO] Testing API endpoint...
    curl -sf http://localhost:5050/api/status >nul 2>&1 && echo [OK] Assistant API is responding at http://localhost:5050 || echo [WARN] Assistant API is not responding
    exit /b 0
)

echo [INFO] Starting Ollama and AI Assistant containers...
docker compose --profile bahmni-standard up -d ollama assistant

echo [INFO] Waiting for Ollama to be ready...
:wait_ollama
timeout /t 2 /nobreak >nul
curl -sf http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 goto wait_ollama
echo [OK] Ollama is ready

echo [INFO] Starting assistant API...
:wait_assistant
timeout /t 2 /nobreak >nul
curl -sf http://localhost:5050/api/status >nul 2>&1
if %errorlevel% neq 0 goto wait_assistant
echo [OK] Assistant API is ready

echo.
echo ======================================
echo   AI Clinical Assistant is Running!
echo ======================================
echo.
echo   Direct:   http://localhost:5050/
echo   Proxy:    http://localhost:8186/assistant/
echo   Bahmni:   http://localhost:8186/ (click 'AI Assistant' in header)
echo.
echo   Model:    %MODEL%
echo   Ollama:   http://localhost:11434
echo.
echo   To stop:  start_assistant.cmd --stop
echo   Status:   start_assistant.cmd --status
echo.

endlocal
