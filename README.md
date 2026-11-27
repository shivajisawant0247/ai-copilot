# AI Data Engineering Copilot

An end-to-end AI-powered data engineering platform built with **React + TypeScript + Tailwind CSS + Recharts** on the frontend and **FastAPI + LangGraph + DuckDB + PostgreSQL + Pandas** on the backend.

## Architecture

- `frontend/` — React 18, TypeScript, Tailwind CSS v4, Recharts, Lucide React
- `backend/` — FastAPI REST API, LangGraph multi-agent scaffold, DuckDB & Pandas integration
- `docker-compose.yml` — Multi-container setup for PostgreSQL, FastAPI backend, and React frontend

## Running Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

When the FastAPI backend is not running, the frontend automatically operates in **Demo Mode (Mock AI)** with real client-side CSV/JSON parsing, cleaning previews, SQL preview execution, interactive Recharts analytics, ETL DAG simulation, ML evaluation/prediction, AI chat, and PDF report export.

## Running Backend Locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Docker Deployment

```bash
docker compose up --build
```
