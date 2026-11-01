@echo off
title RouteXAI Platform - Unified Launcher
echo =========================================================
echo               RouteXAI Platform Launcher                 
echo =========================================================
echo Starting 1/3: FastAPI ML Microservice (Port 8000)...
start "RouteXAI - FastAPI ML Microservice (8000)" cmd /k "py -m uvicorn ml.services.eta_api:app --host 127.0.0.1 --port 8000 || python -m uvicorn ml.services.eta_api:app --host 127.0.0.1 --port 8000"

echo Starting 2/3: Node.js Express Backend (Port 5000)...
start "RouteXAI - Node Backend (5000)" cmd /k "cd backend && node server.js"

echo Starting 3/3: Vite React Frontend (Port 3000)...
start "RouteXAI - Frontend UI (3000)" cmd /k "cd frontend && npm run dev"

echo =========================================================
echo All 3 RouteXAI Services started successfully!
echo - Frontend UI:  http://localhost:3000
echo - Node Backend: http://localhost:5000
echo - FastAPI ML:   http://127.0.0.1:8000
echo =========================================================
pause
