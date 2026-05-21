# SmartPipeline

AI-powered data validation, profiling, and interactive insight generation for operational datasets.

SmartPipeline is a full-stack product experience that turns uploaded CSV and Excel files into structured, queryable, and validation-ready intelligence. It combines deterministic Pandas profiling, AI-assisted schema interpretation, natural language querying, generated Pydantic validation models, and a premium React dashboard designed to feel like a real SaaS product rather than a utility demo.

## Why SmartPipeline Exists

Teams regularly receive raw operational files from internal systems, partners, vendors, or customers, then spend hours manually checking completeness, guessing schema intent, identifying anomalies, and writing downstream validation logic. That work is usually fragmented across spreadsheets, notebooks, ad-hoc scripts, and backend tickets.

SmartPipeline brings that workflow together into one system:

- upload a file
- profile it automatically
- surface issues and anomalies
- enrich fields with AI-based semantic interpretation
- generate validation guidance
- explore the dataset with natural language

The result is a faster path from raw tabular data to trustworthy, actionable insight.

## Product Highlights

- `AI schema inference` with Gemini-powered semantic column analysis
- `Rule-based anomaly detection` for null density, constant columns, non-negative violations, and mixed-case inconsistency
- `Natural language querying` translated into safe, restricted Pandas expressions
- `Generated Pydantic models` based on enriched column understanding
- `Asynchronous job workflow` with progress tracking and result retrieval
- `Interactive dashboard` for upload, processing, analysis, querying, and project documentation
- `Local-first runtime` that works on restricted machines without Docker, Redis, or Celery running locally

## What It Solves

From a business perspective, SmartPipeline reduces the cost of low-trust data. It helps teams catch bad data earlier, shorten data onboarding cycles, and move from discovery to validation much faster. Instead of waiting for downstream failures or manual review cycles, teams get structured feedback immediately after upload.

From a user perspective, it removes the "open spreadsheet and figure it out" problem. A user can upload a file, watch the pipeline process it, inspect issues column by column, ask plain-English questions about the data, and leave with clear next steps and reusable validation logic.

## Demo Workflow

```text
Upload file
   ↓
Create job record
   ↓
Background processing starts
   ↓
Pandas profiling and anomaly checks
   ↓
Gemini enrichment and summary generation
   ↓
Persist results in PostgreSQL
   ↓
Render dashboard, model output, and query interface
```

## Architecture

### Current Local-First Runtime

The current implementation is optimized for local development and restricted environments.

```text
Browser / User
      |
      v
React Frontend
      |
      v
FastAPI Backend
      |
      v
FastAPI Background Task
      |
      v
Pandas Processing Engine
      |
      +----------------------+
      |                      |
      v                      v
Gemini AI              PostgreSQL
      |                      ^
      +----------+-----------+
                 |
                 v
         Result returned to UI
```

### Scale-Out Path Preserved in the Repository

The repository also retains worker-oriented modules that document the intended distributed execution path:

```text
Browser / User
      |
      v
React Frontend
      |
      v
FastAPI Backend
      |
      v
Redis Queue
      |
      v
Celery Worker
      |
      v
Pandas Processing
      |
      v
Gemini AI
      |
      v
PostgreSQL
      |
      v
Response to UI
```

This is useful because the local runtime is practical for development on restricted laptops, while the architectural separation still supports future cloud or worker-based expansion.

## Tech Stack

### Frontend

- `React`
- `TypeScript`
- `Vite`
- `Axios`
- `Recharts`
- `Lucide React`
- Custom premium CSS design system

### Backend

- `FastAPI`
- `Pydantic v2`
- `SQLAlchemy async`
- `asyncpg`
- `Alembic`

### Data and AI

- `Pandas`
- `OpenPyXL`
- `xlrd`
- `Gemini` via `langchain-google-genai`

### Persistence and Runtime

- `PostgreSQL`
- In-memory dataframe cache
- In-memory job runtime progress store

## Key Features

### 1. File Upload and Validation

SmartPipeline accepts `.csv`, `.xlsx`, and `.xls` files. Uploads are validated for supported extension and file size before being persisted to disk and associated with a durable job record in PostgreSQL.

### 2. Deterministic Data Profiling

The `DataProcessor` loads files, handles common CSV encoding fallbacks, infers practical data types, and computes column-level metrics:

- dtype
- null count and null percentage
- unique count
- sample values
- min and max values for numeric and datetime fields

### 3. Rule-Based Anomaly Detection

Before any AI call happens, the backend checks for immediate data quality signals, including:

- more than 50% missing values
- constant columns
- negative values in likely non-negative fields such as age or amount
- mixed-case inconsistency in high-cardinality string fields

This ensures the platform remains useful even if the AI layer is unavailable.

### 4. AI Enrichment

The `AIDataAnalyzer` sends compact column summaries to Gemini and expects structured JSON output describing:

- inferred semantic type
- domain-specific anomalies
- suggested validation logic

The enrichment layer is wrapped with graceful fallback behavior so AI failures do not block the pipeline.

### 5. Suggested Validation Model

SmartPipeline can generate a full Pydantic v2 model from enriched column information, helping engineering teams turn data exploration into actual schema enforcement.

### 6. Natural Language Querying

Users can ask questions like:

- `Show rows where age > 60`
- `Find rows with missing diagnosis codes`
- `Show rows where patient_id equals P001`

The backend converts these into safe Pandas expressions, validates them, and runs them in a restricted evaluation environment.

### 7. Query History

Every successful question is stored in `query_history`, making the query experience more traceable and reusable.

## Security Design

SmartPipeline treats the query layer as a constrained execution environment rather than a free-form code runner.

Important protections include:

- file type restrictions on upload
- file size limits
- normalized upload storage paths
- strict request and response schemas
- restricted `eval()` globals for dataframe filtering
- blocked tokens like `eval`, `exec`, `import`, `open`, `os`, and `sys`
- AST validation of generated expressions
- 500-character expression limit
- enforcement that evaluated expressions produce boolean masks only

These guardrails are especially important because the system accepts natural-language requests and translates them into executable dataframe filters.

## Local Development Setup

### Prerequisites

- `Python 3.11+`
- `Node.js 20+`
- `PostgreSQL`
- `Gemini API key`

Optional for future scale-out mode:

- `Redis`
- `Celery`

### 1. Configure Environment

Create a root `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Example values:

```env
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql+asyncpg://sp_user:sp_pass@localhost:5432/smartpipeline
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
```

Note: the current local-first runtime does not require Redis to run the core product flow, but the environment key remains for compatibility with the preserved worker-oriented architecture.

### 2. Start PostgreSQL

Create the `smartpipeline` database locally and ensure your credentials match the configured `DATABASE_URL`.

### 3. Run the Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Run the Frontend

```powershell
cd frontend
npm install
npm run dev
```

### 5. Open the App

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## API Overview

### Upload

- `POST /api/upload`
- Accepts CSV or Excel file upload
- Creates a job and starts background processing

### Jobs

- `GET /api/jobs/{job_id}/status`
- `GET /api/jobs/{job_id}/result`
- `GET /api/jobs/{job_id}/query-history`
- `GET /api/jobs/{job_id}/suggested-model`

### Query

- `POST /api/query`
- Accepts a natural language question plus `job_id`
- Returns result rows, columns, expression trace, and explanation

### Health

- `GET /api/health`

## Request Lifecycle

### Upload Flow

1. Frontend sends multipart file upload
2. FastAPI validates the file
3. File is stored to disk
4. Job row is created in PostgreSQL
5. Background task starts processing
6. Frontend polls status endpoint
7. Result payload is retrieved when complete

### Query Flow

1. User asks a natural-language question
2. Backend loads the dataframe from cache or disk
3. Column schema is read from the saved job result
4. Query engine builds a deterministic or AI-assisted expression
5. Expression is validated and executed safely
6. Query history is stored
7. Results are returned to the dashboard

## Folder Structure

```text
frontend/
  src/
    api/
    components/
    hooks/
    types/

backend/
  alembic/
  models/
  routers/
  services/
  workers/
  main.py
  config.py
  database.py
```

### What Each Area Does

- `frontend/`
  - dashboard UI, API client, polling hooks, documentation view, and analysis experience
- `backend/routers/`
  - HTTP endpoints for uploads, jobs, querying, and health
- `backend/services/`
  - business logic for processing, AI enrichment, caching, runtime progress, querying, and model suggestion
- `backend/models/`
  - SQLAlchemy ORM models and Pydantic schemas
- `backend/workers/`
  - preserved scale-out worker scaffolding for Celery-based execution
- `backend/alembic/`
  - database migrations

## Important Engineering Decisions

### Why FastAPI

FastAPI gives the project strong typed request and response contracts, async-friendly routing, and an API-centric development model that fits modern Python services.

### Why Async Processing

Profiling, anomaly analysis, and AI enrichment are not ideal for a blocking request cycle. Separating request submission from execution creates a better user experience and protects API responsiveness.

### Why Local-First Background Tasks

The current runtime uses FastAPI background tasks and an in-memory progress store so the app works on restricted machines where Docker, Redis, or additional services may not be allowed.

### Why Keep Worker Modules

Even though the active runtime is local-first, preserving worker-oriented modules keeps the architecture aligned with future distributed processing needs.

### Why PostgreSQL

The system benefits from durable relational storage for jobs, status transitions, result JSON, query history, and timestamps.

### Why Structured AI Output

SmartPipeline expects JSON-shaped AI responses so that enrichment can be merged safely into deterministic profiling results.

### Why Restricted Query Execution

Natural-language querying is valuable, but only if it stays bounded. Restricted globals, AST validation, token blocking, and boolean-mask enforcement make the query experience much safer.

## Performance Considerations

- dataframe caching avoids reloading the same file for every query
- chunk-aware CSV ingestion reduces memory spikes
- lazy loading is used for some UI pathways such as the generated model view
- polling stops when jobs reach terminal state
- deterministic heuristics handle common NL query cases faster than always relying on AI

## Real-World Use Cases

- healthcare intake file review
- finance and revenue export validation
- CRM migration auditing
- partner feed verification
- warehouse import quality checks
- internal operations reporting hygiene
- pre-ingestion schema review for backend services

## Challenges Solved in This Project

- making async data processing work in restricted local environments
- dealing with real-world CSV encoding and delimiter inconsistency
- blending deterministic profiling with AI enrichment safely
- building a natural-language query system without exposing arbitrary code execution
- presenting technical data-quality analysis through a premium SaaS-style interface

## Future Roadmap

- authentication and user workspaces
- saved projects and result libraries
- multi-file ingestion
- cloud object storage support
- Redis + Celery scale-out runtime
- scheduled validations and alerts
- richer AI confidence and explanation layers
- role-based governance and tenant separation

## Why This Project Works Well for Portfolio and Technical Review

SmartPipeline is a strong showcase project because it is both technically serious and product-oriented. It demonstrates:

- full-stack delivery across React, FastAPI, PostgreSQL, and AI services
- real asynchronous workflow design
- schema-aware data processing
- thoughtful security constraints around dynamic query execution
- strong UX and presentation quality
- ability to turn an engineering tool into a product-grade experience

For recruiters, it reads as a polished product. For engineering managers, it shows architecture, API design, system boundaries, and pragmatic trade-offs. For interviewers, it provides a concrete artifact that is easy to walk through from both the implementation side and the product-thinking side.

## License

Add your preferred license before publishing publicly.
