import { useState } from "react";
import {
  Bot,
  BrainCircuit,
  Database,
  DatabaseZap,
  FileCode2,
  FolderTree,
  Gauge,
  Layers3,
  LayoutTemplate,
  Lock,
  MessageSquareText,
  MousePointerClick,
  RefreshCcw,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const heroBadges = [
  "AI Powered",
  "Production Architecture",
  "Async Processing",
  "Real-time Insights",
  "Secure",
  "Scalable",
];

const featureCards = [
  {
    name: "AI Schema Detection",
    description:
      "SmartPipeline inspects every uploaded dataset and combines deterministic profiling with Gemini-powered interpretation to infer what a field actually represents, not just what type Pandas assigned to it.",
    technicalImplementation:
      "The processing pipeline computes base statistics first, then `AIDataAnalyzer` sends compact column summaries to Gemini and merges inferred types, domain-specific anomalies, and validator suggestions back into the result payload.",
    benefit:
      "Teams move faster because columns such as patient identifiers, revenue fields, dates, and free-text notes become understandable immediately without manual column-by-column review.",
  },
  {
    name: "Rule-Based Data Quality Checks",
    description:
      "Before AI enrichment happens, the engine already surfaces practical quality issues such as high null rates, constant columns, negative values in fields that should be non-negative, and inconsistent casing patterns.",
    technicalImplementation:
      "The `DataProcessor` computes column metrics and applies low-latency anomaly rules directly against the dataframe so core profiling remains reliable even if the AI layer is unavailable.",
    benefit:
      "The product always returns actionable signals, which makes the workflow dependable for local demos, restricted environments, and production-minded use cases.",
  },
  {
    name: "Natural Language Querying",
    description:
      "Users can ask business questions about the uploaded dataset in plain English instead of writing filter logic manually, making the product accessible to analysts, operations teams, and non-engineering stakeholders.",
    technicalImplementation:
      "The `NLQueryEngine` converts natural language into validated Pandas expressions, applies AST-level restrictions, executes the query in a restricted evaluation scope, and stores query history for traceability.",
    benefit:
      "Data review becomes collaborative and fast, especially when product managers, QA analysts, or domain experts need answers without touching Python notebooks.",
  },
  {
    name: "Generated Validation Model",
    description:
      "The system produces a Pydantic model suggestion based on actual observed structure and AI-enriched field meaning, turning profiling output into a concrete implementation artifact.",
    technicalImplementation:
      "The `validation_suggester` service transforms column analyses, inferred semantic types, and validator hints into a full Pydantic v2 model string that can be copied directly into downstream services.",
    benefit:
      "SmartPipeline reduces the gap between discovery and enforcement, helping engineering teams move from raw data understanding to schema governance far more quickly.",
  },
  {
    name: "Asynchronous User Workflow",
    description:
      "Large file analysis is treated as a background workflow instead of a blocking request so the interface feels responsive and product-grade during ingestion and profiling.",
    technicalImplementation:
      "In the current local-first runtime, FastAPI background tasks call `process_file_local`, while `job_runtime_store` tracks transient progress and PostgreSQL stores durable job status and result payloads.",
    benefit:
      "Users get a clear staged experience with progress visibility instead of a frozen screen or long synchronous wait, which improves trust and perceived performance.",
  },
  {
    name: "Dataset-Aware Query Experience",
    description:
      "The query interface adapts itself to the uploaded file by surfacing relevant prompts based on actual columns, anomalies, and inferred types rather than generic canned examples.",
    technicalImplementation:
      "The frontend builds contextual query prompts from the returned `column_analyses`, while the backend retrieves cached dataframes through `file_cache` to avoid repeatedly loading the same file from disk.",
    benefit:
      "The product feels intelligent and guided, which makes exploration easier for first-time users and stronger in portfolio or demo settings.",
  },
];

const userJourney = [
  {
    step: "Step 1",
    title: "User uploads file",
    body: "A CSV or Excel file is submitted through the premium onboarding interface. The UI immediately creates a job context and transitions into a guided workflow instead of treating upload as a plain form submission.",
  },
  {
    step: "Step 2",
    title: "System validates upload",
    body: "The backend verifies extension, applies a 50 MB size guardrail, stores the file safely on disk, persists the job record in PostgreSQL, and assigns a durable job identifier.",
  },
  {
    step: "Step 3",
    title: "Background processing starts",
    body: "FastAPI launches local background processing so the request can return immediately while the job continues in the background with visible progress updates.",
  },
  {
    step: "Step 4",
    title: "Statistics generated",
    body: "The `DataProcessor` loads the file, infers practical types, computes null rates, uniqueness, sample values, min/max values, and fast rule-based anomalies for every column.",
  },
  {
    step: "Step 5",
    title: "AI analysis executes",
    body: "Gemini receives a compact schema-focused prompt and returns structured JSON describing inferred field types, domain-specific anomalies, and validation guidance.",
  },
  {
    step: "Step 6",
    title: "Insights generated",
    body: "The pipeline assembles an executive summary, persists the full result payload, and exposes both human-readable insights and machine-usable validation output.",
  },
  {
    step: "Step 7",
    title: "User interacts with results",
    body: "The user reviews column-level findings, expands individual fields, copies the generated Pydantic model, and queries the dataset through a natural-language assistant experience.",
  },
];

const architectureLayers = [
  {
    title: "Frontend",
    body: "The React + TypeScript dashboard handles onboarding, progress visualization, result exploration, natural language querying, and project documentation. It is designed to feel like a real SaaS workspace rather than a developer utility.",
  },
  {
    title: "API Layer",
    body: "FastAPI exposes upload, health, job status, result retrieval, query execution, query history, and suggested model endpoints. Async routing keeps request handling efficient while preserving strong schema contracts.",
  },
  {
    title: "Background Processing",
    body: "The current local-first runtime uses FastAPI background tasks and an in-process runtime store for progress updates. The repository also preserves worker modules as a scale-out path for future distributed execution.",
  },
  {
    title: "Database",
    body: "PostgreSQL stores durable job records, query history, statuses, completion timestamps, and the final analysis payload so results remain stable and audit-friendly across sessions.",
  },
  {
    title: "Cache",
    body: "An in-memory dataframe cache avoids re-reading the same uploaded file for every follow-up question. A separate in-memory job runtime store maintains transient progress and user-facing status text.",
  },
  {
    title: "AI Services",
    body: "Gemini is used for semantic interpretation, domain-specific anomaly detection, concise executive summaries, and natural-language-to-query translation with structured output expectations.",
  },
];

const technicalSections = [
  {
    title: "Frontend",
    purpose:
      "Present SmartPipeline as a polished operator-facing product where upload, progress, analysis, querying, and generated output all feel cohesive.",
    technologies:
      "React, TypeScript, Vite, Axios, Recharts, Lucide icons, custom CSS design system.",
    responsibilities:
      "State transitions, upload UX, live polling, interactive accordion review, contextual query prompting, model copy experience, and documentation presentation.",
  },
  {
    title: "Backend",
    purpose:
      "Provide a typed, production-friendly API layer for file ingestion, processing orchestration, querying, and result delivery.",
    technologies:
      "FastAPI, Pydantic v2, SQLAlchemy async, asyncpg, Alembic.",
    responsibilities:
      "Request validation, background task dispatch, job persistence, API contracts, query routing, and safe integration across services.",
  },
  {
    title: "Database",
    purpose:
      "Act as the system of record for jobs, final results, timestamps, and user query history.",
    technologies:
      "PostgreSQL with SQLAlchemy ORM models and Alembic migrations.",
    responsibilities:
      "Durable job storage, result JSON persistence, query history tracking, and lifecycle state management.",
  },
  {
    title: "AI Layer",
    purpose:
      "Enrich deterministic profiling with semantic understanding so the product can move from raw statistics to business-meaningful interpretation.",
    technologies:
      "Gemini via `langchain-google-genai`.",
    responsibilities:
      "Column type inference, anomaly reasoning, validator suggestion generation, executive summaries, and NL query translation.",
  },
  {
    title: "Queue System",
    purpose:
      "Support asynchronous execution semantics so uploads do not block the UI and long-running analysis remains observable.",
    technologies:
      "Current runtime uses FastAPI background tasks and `job_runtime_store`; legacy `workers/` modules document the future Redis + Celery scale-out path.",
    responsibilities:
      "Decoupling the user request from processing, staging progress messages, and preserving an architecture path toward distributed workers.",
  },
  {
    title: "Caching Layer",
    purpose:
      "Reduce unnecessary repeated computation when users ask multiple questions against the same uploaded dataset.",
    technologies:
      "In-memory `FileCache` and `JobRuntimeStore` abstractions.",
    responsibilities:
      "Caching loaded dataframes, preserving query responsiveness, and storing transient progress independently from durable database state.",
  },
  {
    title: "Processing Engine",
    purpose:
      "Turn unstructured file uploads into structured profiling, anomaly insight, and reusable validation output.",
    technologies:
      "Pandas, OpenPyXL, xlrd, custom `DataProcessor`, `processing_service`, `validation_suggester`.",
    responsibilities:
      "File decoding, chunk-aware ingestion, type inference, statistical profiling, anomaly detection, enrichment orchestration, and result assembly.",
  },
];

const folderSections = [
  {
    path: "frontend/",
    body:
      "Contains the React application, UI components, typed API clients, design system styles, polling hooks, and all product-facing presentation logic.",
  },
  {
    path: "backend/",
    body:
      "Contains the FastAPI application, configuration, database setup, migrations, service layer, routers, and compatibility worker modules.",
  },
  {
    path: "services/",
    body:
      "Holds the business logic layer, including data processing, AI analysis, natural language query translation, runtime progress tracking, validation suggestion, and file caching.",
  },
  {
    path: "routers/",
    body:
      "Defines the HTTP interface for uploads, job state retrieval, health checks, natural language querying, query history, and generated model access.",
  },
  {
    path: "workers/",
    body:
      "Currently acts as compatibility scaffolding for local mode while preserving the conceptual shape of a distributed worker architecture for future Redis/Celery activation.",
  },
  {
    path: "models/",
    body:
      "Defines both SQLAlchemy ORM models for persistence and Pydantic schemas for API request/response contracts and job result payloads.",
  },
];

const decisions = [
  {
    title: "Why FastAPI",
    body:
      "FastAPI offers typed contracts, async-friendly request handling, automatic documentation, and a clear development experience that suits API-centric products and modern Python service design.",
  },
  {
    title: "Why Redis + Celery",
    body:
      "The repository was originally shaped for proper queued background work and retry semantics. Even though the current local-restricted mode runs without Redis, the Celery worker pattern remains the right evolution path for scale-out deployments.",
  },
  {
    title: "Why async processing",
    body:
      "File analysis can take meaningful time, especially with profiling and AI enrichment. Separating submission from execution creates a far better product experience and protects API responsiveness.",
  },
  {
    title: "Why AI structured output",
    body:
      "Structured JSON prompts make AI responses composable, safer to parse, and easier to merge back into deterministic column statistics and generated models.",
  },
  {
    title: "Why PostgreSQL",
    body:
      "The project benefits from a reliable transactional store that can persist job records, query history, and result payloads cleanly while staying familiar to backend teams.",
  },
  {
    title: "Why caching",
    body:
      "Repeatedly loading the same source file from disk would slow down interactive analysis. Caching the dataframe by job id keeps the query experience responsive.",
  },
  {
    title: "Why chunked processing",
    body:
      "Reading large files in controlled slices helps keep memory use practical and makes the ingestion pipeline more resilient for operational datasets.",
  },
];

const securityItems = [
  {
    title: "Input validation",
    body:
      "The API validates job identifiers, request shapes, and file metadata before entering the processing path. Pydantic schemas help keep both the input and returned payloads predictable.",
  },
  {
    title: "File restrictions",
    body:
      "Only CSV and Excel uploads are accepted, filenames are normalized before storage, and size caps prevent overly large payloads from being accepted blindly.",
  },
  {
    title: "Query protection",
    body:
      "Natural language queries are translated into bounded dataframe expressions and then validated before execution so the system does not become a generic code execution surface.",
  },
  {
    title: "Restricted execution",
    body:
      "Query execution uses restricted globals with no builtins exposed, disallows dangerous tokens, limits expression length, and ensures the evaluated result is a boolean mask before it is used.",
  },
  {
    title: "Rate limiting possibilities",
    body:
      "The current local-first version focuses on developer and demo usability, but the API shape is compatible with request throttling, tenant-specific quotas, and auth-gated usage in a larger deployment.",
  },
  {
    title: "Data handling",
    body:
      "Uploaded files are stored with job-scoped filenames, result payloads are persisted intentionally, and transient progress data is separated from long-lived records for cleaner lifecycle handling.",
  },
];

const performanceItems = [
  {
    title: "Caching",
    body:
      "The dataframe cache removes repeated file reads during iterative natural language exploration, which is one of the highest-value optimizations for interactive usage.",
  },
  {
    title: "Background workers",
    body:
      "Even in local mode, work is decoupled from the upload request so the UI can remain responsive and communicate state instead of blocking end users.",
  },
  {
    title: "Chunk processing",
    body:
      "Chunk-aware CSV ingestion limits memory spikes on larger datasets and makes the loader more tolerant of real operational data volume.",
  },
  {
    title: "Lazy loading",
    body:
      "The suggested model is fetched only when the user opens that tab, which avoids unnecessary network work and keeps the initial results screen fast.",
  },
  {
    title: "Polling strategy",
    body:
      "The frontend polls job status at a fixed interval and stops on terminal states, which keeps the implementation understandable while still delivering live feedback.",
  },
];

const challenges = [
  {
    challenge: "Restricted local environment",
    problem:
      "The original queue-based setup is harder to run on office laptops or locked-down environments where Redis and Docker are not available.",
    solution:
      "The system was adapted to a local-first runtime using FastAPI background tasks, in-memory progress tracking, and the same API-facing workflow semantics.",
    outcome:
      "The product remains demonstrable and functional without giving up the architecture principles of asynchronous processing.",
  },
  {
    challenge: "Unpredictable CSV quality",
    problem:
      "Operational CSV exports can arrive with inconsistent encodings, delimiters, blank values, and mixed typing that break naive loaders.",
    solution:
      "The processor now retries common encodings, infers practical separators, preserves string-first loading where needed, and applies controlled type inference after ingestion.",
    outcome:
      "Uploads are more resilient to real-world exports from business tools and Windows-based reporting workflows.",
  },
  {
    challenge: "Unsafe query generation risk",
    problem:
      "Natural language querying is attractive, but raw AI-generated code can become brittle or unsafe very quickly.",
    solution:
      "The project combines deterministic heuristics, AST validation, blocked token detection, restricted globals, expression length limits, and boolean mask enforcement.",
    outcome:
      "The user gets a flexible query experience without turning the backend into an arbitrary execution engine.",
  },
  {
    challenge: "AI reliability",
    problem:
      "LLM responses can fail, return malformed JSON, or use outdated assumptions, which is risky in a production-minded workflow.",
    solution:
      "The enrichment layer uses structured prompts, JSON parsing retries, graceful fallback logic, and deterministic rule-based analysis underneath the AI layer.",
    outcome:
      "The pipeline keeps working even when the AI path is unavailable, which improves trust and operational stability.",
  },
];

const roadmap = [
  {
    phase: "Phase 1",
    body:
      "Add authentication, user workspaces, project collections, and saved result libraries so SmartPipeline becomes a multi-session product rather than a single-run analysis tool.",
  },
  {
    phase: "Phase 2",
    body:
      "Activate the distributed queue path with Redis and Celery, add multi-file ingestion, scheduled validations, and webhook-based pipeline triggers for operational teams.",
  },
  {
    phase: "Phase 3",
    body:
      "Introduce tenant-aware governance, role-based access, alerting, downloadable reports, and versioned data quality policies for production deployments.",
  },
  {
    phase: "Future AI improvements",
    body:
      "Expand semantic typing breadth, add anomaly explanation confidence scoring, support conversational follow-up queries, and generate richer validators across multiple backend frameworks.",
  },
];

export function AboutSection() {
  const [activeTechSection, setActiveTechSection] = useState(technicalSections[0].title);

  const selectedTechSection =
    technicalSections.find((section) => section.title === activeTechSection) ?? technicalSections[0];

  const docSections = [
    { id: "about-hero", label: "Hero" },
    { id: "about-overview", label: "Overview" },
    { id: "about-problem", label: "Problem" },
    { id: "about-features", label: "Features" },
    { id: "about-journey", label: "Journey" },
    { id: "about-architecture", label: "Architecture" },
    { id: "about-diagrams", label: "Diagrams" },
    { id: "about-deep-dive", label: "Deep dive" },
    { id: "about-api", label: "API flow" },
    { id: "about-summary", label: "Summary" },
  ];

  const visualArchitecture = [
    {
      title: "Frontend",
      detail: "React + TypeScript dashboard for upload, progress, documentation, analytics, and NL querying.",
    },
    {
      title: "FastAPI Layer",
      detail: "Typed APIs for ingestion, status, results, query execution, model generation, and health checks.",
    },
    {
      title: "Processing Runtime",
      detail: "FastAPI background tasks drive asynchronous local processing with visible staged progress.",
    },
    {
      title: "Persistence + Cache",
      detail: "PostgreSQL stores durable job state while in-memory cache/runtime stores keep interaction fast.",
    },
    {
      title: "AI + Insight Engine",
      detail: "Gemini enriches schema meaning, anomaly reasoning, summaries, and natural-language query translation.",
    },
  ];

  const interactiveDiagrams = [
    {
      title: "Upload to Insight Lifecycle",
      nodes: [
        "File upload",
        "Validation gate",
        "Background analysis",
        "Pandas profiling",
        "AI enrichment",
        "Results + query UI",
      ],
    },
    {
      title: "Query Execution Path",
      nodes: [
        "User question",
        "Schema-aware prompt",
        "Safe expression build",
        "Restricted eval",
        "Result preview",
        "Query history save",
      ],
    },
  ];

  function jumpToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="about-shell">
      <div className="about-doc-nav glass-panel">
        <div>
          <p className="eyebrow">Documentation Navigator</p>
          <h3>Explore SmartPipeline like a product walkthrough</h3>
        </div>
        <div className="about-doc-nav-row">
          {docSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="about-doc-chip"
              onClick={() => jumpToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <header id="about-hero" className="about-hero glass-panel">
        <div className="about-hero-main">
          <span className="hero-badge">
            <Sparkles size={14} />
            Premium project documentation
          </span>
          <p className="eyebrow">1. Hero Section</p>
          <h2>SmartPipeline</h2>
          <p className="about-one-liner">
            AI-powered data validation, profiling, and interactive insight generation for operational datasets.
          </p>
          <p className="about-description">
            SmartPipeline turns uploaded CSV and Excel files into structured, queryable, and validation-ready intelligence.
            It combines deterministic Pandas profiling, AI-assisted schema understanding, generated validation logic,
            and a polished analyst-facing interface that makes data quality review feel like a modern SaaS product.
          </p>
          <div className="about-badge-row">
            {heroBadges.map((badge) => (
              <span key={badge} className="about-badge">
                {badge}
              </span>
            ))}
          </div>
        </div>

        <aside className="about-problem-card">
          <div className="about-section-icon">
            <ShieldCheck size={18} />
          </div>
          <h3>What problem this solves</h3>
          <p>
            In business terms, SmartPipeline reduces the cost of low-trust data by making upload review, anomaly
            detection, schema understanding, and validation design dramatically faster. Teams spend less time
            debugging broken records, chasing spreadsheet inconsistencies, and manually translating raw fields into
            enforceable system rules.
          </p>
          <p>
            In user terms, it helps someone drop in a file, see what is wrong, understand what each column means, ask
            questions in plain English, and leave with clear next steps instead of a confusing wall of raw data.
          </p>
        </aside>
      </header>

      <section id="about-overview" className="about-section">
        <div className="about-section-heading">
          <LayoutTemplate size={18} />
          <div>
            <p className="eyebrow">2. Project Overview</p>
            <h3>Project overview</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            SmartPipeline is an AI-powered data validation and insights engine designed to bridge the gap between raw
            file ingestion and trustworthy operational decision-making. A user uploads a CSV or Excel file, and the
            platform immediately converts that file into a structured review workflow that includes profiling,
            anomaly detection, AI schema interpretation, generated validation guidance, and natural language
            exploration.
          </p>
          <p>
            The project exists because data quality work is usually fragmented. Profiling often happens in notebooks,
            rules are documented elsewhere, analysts ask questions in spreadsheets, and backend teams separately write
            validators later. SmartPipeline brings those stages into one product-shaped experience so the workflow
            becomes faster, more intelligible, and easier to demonstrate to both technical and non-technical
            stakeholders.
          </p>
          <p>
            The target users include backend engineers, data analysts, platform teams, operations teams, technical
            product managers, internal tooling builders, and teams responsible for onboarding partner or customer
            datasets. Real-world use cases include healthcare file intake, finance and revenue operations review,
            warehouse import validation, CRM migration checks, partner feed auditing, and any scenario where a team
            needs confidence in tabular data before pushing it downstream.
          </p>
          <p>
            The product value is twofold. It saves time by automating the first-pass interpretation of a dataset, and
            it improves quality by turning insight into structured outputs such as validation suggestions and safe query
            pathways. The expected business impact is lower manual review cost, faster data onboarding, fewer downstream
            failures, and a more consistent way to operationalize data quality work across teams.
          </p>
        </div>
      </section>

      <section id="about-problem" className="about-section">
        <div className="about-section-heading">
          <MessageSquareText size={18} />
          <div>
            <p className="eyebrow">3. Problem Statement</p>
            <h3>Problem statement</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            The traditional approach to data validation is fragmented, manual, and error-prone. Teams typically receive
            a spreadsheet or CSV export, open it in a desktop tool, try to guess which fields matter, manually scan for
            suspicious values, and then switch into a separate engineering workflow to codify validation rules. That
            process fails because it is slow, inconsistent across reviewers, and heavily dependent on tribal knowledge.
          </p>
          <p>
            Existing pain points include time lost during manual inspection, repeated context switching between tools,
            uncertainty about what a field actually represents, poor visibility into nulls and outliers, and difficulty
            translating observations into backend-ready validation logic. Data quality issues are often discovered late,
            after the data has already flowed into reports, downstream services, or operational decisions.
          </p>
          <p>
            User frustration grows when the same dataset has to be re-opened multiple times, when questions require
            ad-hoc scripting, or when business stakeholders need answers but cannot work directly with Python or SQL.
            SmartPipeline solves this by turning a raw upload into a guided, asynchronous, reviewable product
            experience. It standardizes statistical profiling, adds semantic AI interpretation, persists results,
            enables plain-English interaction, and creates a clear path from detection to enforcement.
          </p>
        </div>
      </section>

      <section id="about-features" className="about-section">
        <div className="about-section-heading">
          <BrainCircuit size={18} />
          <div>
            <p className="eyebrow">4. Core Features</p>
            <h3>Core features</h3>
          </div>
        </div>
        <div className="about-card-grid">
          {featureCards.map((feature) => (
            <article key={feature.name} className="about-feature-card glass-panel">
              <h4>{feature.name}</h4>
              <p>
                <strong>Description:</strong> {feature.description}
              </p>
              <p>
                <strong>Technical implementation:</strong> {feature.technicalImplementation}
              </p>
              <p>
                <strong>Benefit:</strong> {feature.benefit}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="about-journey" className="about-section">
        <div className="about-section-heading">
          <Workflow size={18} />
          <div>
            <p className="eyebrow">5. User Journey</p>
            <h3>User journey</h3>
          </div>
        </div>
        <div className="about-journey">
          {userJourney.map((item, index) => (
            <div key={item.step} className="about-journey-item">
              <div className="about-journey-card glass-panel">
                <span className="about-step-tag">{item.step}</span>
                <h4>{item.title}</h4>
                <p>{item.body}</p>
              </div>
              {index < userJourney.length - 1 ? <div className="about-journey-arrow">↓</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section id="about-architecture" className="about-section">
        <div className="about-section-heading">
          <Layers3 size={18} />
          <div>
            <p className="eyebrow">6. System Architecture</p>
            <h3>System architecture</h3>
          </div>
        </div>
        <div className="about-layer-stack">
          {architectureLayers.map((layer, index) => (
            <div key={layer.title} className="about-layer-item">
              <article className="about-layer-card glass-panel">
                <h4>{layer.title}</h4>
                <p>{layer.body}</p>
              </article>
              {index < architectureLayers.length - 1 ? <div className="about-journey-arrow">↓</div> : null}
            </div>
          ))}
        </div>

        <div className="about-visual-architecture">
          {visualArchitecture.map((layer, index) => (
            <div key={layer.title} className="about-visual-architecture-item">
              <article className="about-visual-card glass-panel">
                <div className="about-visual-card-head">
                  <span className="about-visual-index">0{index + 1}</span>
                  <h4>{layer.title}</h4>
                </div>
                <p>{layer.detail}</p>
              </article>
              {index < visualArchitecture.length - 1 ? <div className="about-visual-arrow">→</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section id="about-diagrams" className="about-section">
        <div className="about-section-heading">
          <ServerCog size={18} />
          <div>
            <p className="eyebrow">7. Architecture Flow Diagram</p>
            <h3>Architecture flow diagram</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            The current local-first runtime uses FastAPI background tasks and in-memory runtime tracking. The diagram
            below shows the distributed scale-out flow the repository was originally structured around and can evolve
            back toward when Redis and worker infrastructure are enabled.
          </p>
        </div>

        <div className="about-diagram-grid">
          {interactiveDiagrams.map((diagram) => (
            <article key={diagram.title} className="about-diagram-card glass-panel">
              <h4>{diagram.title}</h4>
              <div className="about-diagram-lane">
                {diagram.nodes.map((node, index) => (
                  <div key={`${diagram.title}-${node}`} className="about-diagram-node-wrap">
                    <div className="about-diagram-node">{node}</div>
                    {index < diagram.nodes.length - 1 ? <div className="about-diagram-node-arrow">→</div> : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <pre className="about-diagram">
{`Browser / User
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
Response to UI`}
        </pre>
      </section>

      <section id="about-deep-dive" className="about-section">
        <div className="about-section-heading">
          <Gauge size={18} />
          <div>
            <p className="eyebrow">8. Technical Deep Dive</p>
            <h3>Technical deep dive</h3>
          </div>
        </div>
        <div className="about-stack-explorer glass-panel">
          <div className="about-stack-explorer-header">
            <div>
              <p className="eyebrow">Interactive stack explorer</p>
              <h4>Inspect the platform layer by layer</h4>
            </div>
            <div className="about-stack-badges">
              <span className="about-mini-badge">
                <MousePointerClick size={14} />
                Click a layer
              </span>
              <span className="about-mini-badge">
                <DatabaseZap size={14} />
                Real implementation details
              </span>
            </div>
          </div>

          <div className="about-stack-tabs">
            {technicalSections.map((section) => (
              <button
                key={section.title}
                type="button"
                className={`about-stack-tab ${section.title === activeTechSection ? "active" : ""}`}
                onClick={() => setActiveTechSection(section.title)}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="about-stack-panel">
            <article className="about-stack-detail">
              <h4>{selectedTechSection.title}</h4>
              <p>
                <strong>Purpose:</strong> {selectedTechSection.purpose}
              </p>
              <p>
                <strong>Technologies used:</strong> {selectedTechSection.technologies}
              </p>
              <p>
                <strong>Responsibilities:</strong> {selectedTechSection.responsibilities}
              </p>
            </article>
          </div>
        </div>

        <div className="about-card-grid">
          {technicalSections.map((section) => (
            <article key={section.title} className="about-feature-card glass-panel">
              <h4>{section.title}</h4>
              <p>
                <strong>Purpose:</strong> {section.purpose}
              </p>
              <p>
                <strong>Technologies used:</strong> {section.technologies}
              </p>
              <p>
                <strong>Responsibilities:</strong> {section.responsibilities}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <FolderTree size={18} />
          <div>
            <p className="eyebrow">9. Folder Structure Explanation</p>
            <h3>Folder structure explanation</h3>
          </div>
        </div>
        <div className="about-card-grid compact">
          {folderSections.map((item) => (
            <article key={item.path} className="about-feature-card glass-panel">
              <h4>{item.path}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about-api" className="about-section">
        <div className="about-section-heading">
          <RefreshCcw size={18} />
          <div>
            <p className="eyebrow">10. API Flow</p>
            <h3>API flow</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            <strong>Upload API:</strong> The frontend posts multipart form data to `/api/upload`. The backend validates
            the file, writes it to disk, creates a job record in PostgreSQL, and schedules background processing.
          </p>
          <p>
            <strong>Processing API path:</strong> The background service loads the file, profiles columns, enriches
            results with AI where available, and persists the completed `JobResult` payload back into the jobs table.
          </p>
          <p>
            <strong>Status API:</strong> The UI polls `/api/jobs/{`{job_id}`}/status` to retrieve durable job status
            from PostgreSQL plus live progress information from the runtime store.
          </p>
          <p>
            <strong>Query API:</strong> `/api/query` loads the cached dataframe, builds or generates a safe expression,
            executes the filtered query, stores query history, and returns a bounded preview result set.
          </p>
          <p>
            <strong>Response API:</strong> `/api/jobs/{`{job_id}`}/result`, `/api/jobs/{`{job_id}`}/query-history`, and
            `/api/jobs/{`{job_id}`}/suggested-model` provide the post-processing exploration layer for the UI.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <Rocket size={18} />
          <div>
            <p className="eyebrow">11. Important Engineering Decisions</p>
            <h3>Important engineering decisions</h3>
          </div>
        </div>
        <div className="about-card-grid compact">
          {decisions.map((decision) => (
            <article key={decision.title} className="about-feature-card glass-panel">
              <h4>{decision.title}</h4>
              <p>{decision.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <Lock size={18} />
          <div>
            <p className="eyebrow">12. Security Considerations</p>
            <h3>Security considerations</h3>
          </div>
        </div>
        <div className="about-card-grid compact">
          {securityItems.map((item) => (
            <article key={item.title} className="about-feature-card glass-panel">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <Gauge size={18} />
          <div>
            <p className="eyebrow">13. Performance Optimization</p>
            <h3>Performance optimization</h3>
          </div>
        </div>
        <div className="about-card-grid compact">
          {performanceItems.map((item) => (
            <article key={item.title} className="about-feature-card glass-panel">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <ShieldCheck size={18} />
          <div>
            <p className="eyebrow">14. Challenges & Solutions</p>
            <h3>Challenges and solutions</h3>
          </div>
        </div>
        <div className="about-card-grid">
          {challenges.map((item) => (
            <article key={item.challenge} className="about-feature-card glass-panel">
              <h4>{item.challenge}</h4>
              <p>
                <strong>Problem:</strong> {item.problem}
              </p>
              <p>
                <strong>Solution implemented:</strong> {item.solution}
              </p>
              <p>
                <strong>Outcome:</strong> {item.outcome}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <Database size={18} />
          <div>
            <p className="eyebrow">15. Scalability Considerations</p>
            <h3>Scalability considerations</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            SmartPipeline can scale along several dimensions. For millions of rows, the next evolution is a stronger
            chunking and streaming strategy with partition-aware profiling and object storage-backed file handling.
            For multiple users, the product already benefits from durable job persistence and clear API contracts, and
            can be extended with authentication, tenant separation, and horizontally scaled application instances.
          </p>
          <p>
            For cloud deployment, the retained worker-oriented architecture points naturally toward containerized API
            services, queue-backed workers, managed PostgreSQL, managed Redis, and externalized file storage. For
            distributed workers, Celery-based execution or a comparable job orchestration system can take the current
            `process_file_local` workflow and run it across multiple worker nodes while preserving the same user-facing
            job lifecycle.
          </p>
          <p>
            The important architectural point is that SmartPipeline already separates ingestion, processing, persistence,
            and interaction concerns. That separation is what makes the system capable of evolving from local-first demo
            mode into a broader multi-user product.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <Bot size={18} />
          <div>
            <p className="eyebrow">16. Future Improvements</p>
            <h3>Future improvements</h3>
          </div>
        </div>
        <div className="about-card-grid compact">
          {roadmap.map((item) => (
            <article key={item.phase} className="about-feature-card glass-panel">
              <h4>{item.phase}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about-summary" className="about-section">
        <div className="about-section-heading">
          <FileCode2 size={18} />
          <div>
            <p className="eyebrow">17. Project Summary</p>
            <h3>Project summary</h3>
          </div>
        </div>
        <div className="about-rich-copy">
          <p>
            SmartPipeline is a complete AI-assisted data quality product experience built around real engineering
            concerns rather than a superficial demo flow. It ingests tabular datasets, profiles them, interprets their
            meaning, surfaces anomalies, generates validation guidance, and supports natural language exploration through
            a polished user interface.
          </p>
          <p>
            From a technical perspective, it demonstrates strong separation of concerns across frontend, API, service,
            processing, persistence, and AI layers. From a business perspective, it addresses the high-friction space
            between receiving raw files and trusting them enough to put them into production workflows. From an
            engineering perspective, it showcases thoughtful trade-offs around async execution, safe query handling,
            structured AI output, and local-first operability.
          </p>
          <p>
            The project is also a strong learning and showcase asset because it combines product thinking, backend
            architecture, AI integration, UX design, and operational realism in one system. It reads well to recruiters,
            demonstrates systems thinking to technical managers, and gives interviewers a concrete artifact that is easy
            to walk through from both implementation and product strategy angles.
          </p>
        </div>
      </section>
    </section>
  );
}
