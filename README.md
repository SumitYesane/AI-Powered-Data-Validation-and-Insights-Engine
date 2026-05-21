## SmartPipeline - Quick Start
1. `cp .env.example .env` and add your `GEMINI_API_KEY`
2. Start PostgreSQL locally and make sure the `smartpipeline` database exists
3. In one terminal, run the backend from `backend/` with `uvicorn main:app --reload`
4. In a second terminal, run the frontend from `frontend/` with `npm run dev`
5. Open `http://localhost:5173`
6. Upload a CSV or Excel file
7. Watch AI analyse your data in real-time
8. Ask questions in plain English

## Architecture
```text
+---------+      +------------------+      +---------------------+
| Browser | ---> | React Dashboard  | ---> | FastAPI Backend     |
+---------+      +------------------+      +-----+-----------+---+
                                                     |           |
                                                     v           v
                                           +----------------+  +------------+
                                           | Postgres       |  | Gemini API |
                                           | jobs/results   |  +------------+
                                           +----------------+
```

## Key Technical Decisions
- Local development uses FastAPI background tasks plus an in-memory runtime store for progress, so SmartPipeline works on restricted laptops without Redis or Celery.
- Restricted `eval()` for NL query execution uses the `SAFE_GLOBALS` pattern to prevent code injection and keep dataframe filtering bounded.
- AI schema inference uses structured JSON output prompting with a retry path when parsing fails.
- Pandas chunked processing in 5000-row slices keeps large file analysis practical for local development.
