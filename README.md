<div align="center">

# 🛡️ GraphSentinel

### Custom LLM-Based Customer Support Chatbot for Enterprise Applications

*Final-Year B.Tech Major Project — Computer Science & Engineering (AI & Data Science)*

---

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-AuraDB-008CC1?style=for-the-badge&logo=neo4j&logoColor=white)](https://neo4j.com/cloud/platform/aura-graph-database/)
[![Redis](https://img.shields.io/badge/Upstash-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Llama](https://img.shields.io/badge/Meta-Llama_3.3_70B-0467DF?style=for-the-badge&logo=meta&logoColor=white)](https://llama.meta.com/)
[![Vite](https://img.shields.io/badge/Vite-PWA-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🧠 What is GraphSentinel?

GraphSentinel is an **autonomous, agentic AI support portal** engineered for enterprise IT environments. It addresses the fundamental failure mode of modern LLM-based chatbots — **hallucination** — by grounding every response in a structured, queryable **Neo4j Knowledge Graph** built directly from enterprise product manuals.

Unlike generic RAG systems that retrieve unstructured text chunks, GraphSentinel traverses a typed property graph of entities and relationships, returning factually verified, context-precise answers with near-millisecond latency via a **Semantic Caching** layer powered by Upstash Serverless Redis.

> **Core Research Thesis:** Can an Agentic RAG system backed by a Knowledge Graph statistically outperform both vector-based RAG and zero-shot LLM prompting on enterprise hardware and software troubleshooting benchmarks?

---

## ✨ Key Features

### 🤖 Autonomous Chat Interface
- **Regex + LLM Hybrid Intent Router** — A two-stage pipeline that first uses regex patterns to catch high-priority signals (error codes like `SYS-ERR-*`, ticket numbers like `IT-*`, and product names), then delegates to an LLM keyword extractor as a fallback. This eliminates the latency of running a full LLM on every trivial query.
- **Mock Enterprise Ticketing** — Real-time ticket lookups (`IT-404`, `IT-1001`, etc.) are intercepted before the main pipeline, returning structured status data instantly.
- **Persistent Conversation Memory** — Each user session's full dialogue is stored as a linked-list of `(:Message)` nodes in Neo4j, enabling true cross-session recall without any in-memory state. This makes the backend fully **stateless** and cloud-safe.
- **Real-time IST Clock Awareness** — The LLM system prompt is injected with the current Indian Standard Time on every request, enabling contextually appropriate greetings and temporal reasoning.

### 🔒 Secure Admin Console
- **Client-side Auth Guard** (`ProtectedRoute.jsx`) — Checks `sessionStorage` for an authentication token before rendering any admin view, with zero backend dependency for session management.
- **New-Tab Isolation** — The admin console opens in a separate browser tab via `target="_blank"`, ensuring the user's active chat session is never interrupted or overwritten.
- **Configurable Password** — Admin access is controlled by the `VITE_ADMIN_PASSWORD` environment variable, defaulting securely to `admin123` for local development.

### 📊 Dynamic Knowledge Graph Visualization
- **Live Force-Directed Graph** — Renders up to 1,000 Neo4j entity relationships as an interactive, physics-simulated canvas using `force-graph` — a pure 2D canvas library with zero A-Frame/WebXR dependencies.
- **One-Click Refresh** — A dedicated "Refresh Data" button with a localized loading overlay allows admins to pull in newly ingested nodes without a full page reload.
- **Theme-Aware Rendering** — Node and link colors dynamically adapt to the application's light/dark mode state via CSS variable inspection at render time.

### 📄 Asynchronous Knowledge Ingestion
- **Drag-and-Drop PDF Upload** — Admins can drop enterprise manuals into the upload zone or browse the file system.
- **Non-Blocking Backend** — FastAPI's `BackgroundTasks` receives the file and immediately returns `200 OK`. The heavy LLM extraction pipeline runs in a separate thread, never blocking the API server.
- **Full Lifecycle Polling** — The frontend polls `GET /api/admin/ingestion-status` every 3 seconds after a successful upload. When the backend signals `status: "idle"`, the UI automatically transitions to a success state and triggers a graph refresh — no manual intervention required.
- **24-Hour Auto-Ingestion** — APScheduler runs `run_daily_ingestion()` every 24 hours in the background, ensuring the knowledge base stays current without manual uploads.

### ⚡ Semantic Caching
- **MD5-Keyed Cache** — Every unique `(system_prompt, user_message)` pair is hashed to an MD5 key and stored in Upstash Serverless Redis with a **24-hour TTL**.
- **Instant Cache Hits** — Identical or near-identical queries return in milliseconds, dramatically reducing LLM API costs in production.
- **Admin-Controlled Flush** — A "Clear Semantic Cache" control in the admin panel allows operators to invalidate the entire cache instantly via a single `DELETE /api/admin/clear-cache` call, with a confirmation guard to prevent accidents.

---

## 🏗️ System Architecture

### Agentic Pipeline Flow

A complete query lifecycle through GraphSentinel:

```
User Types Message
        │
        ▼
┌─────────────────────────────────┐
│   AGENT 1.5 — Ticket Router     │  ← Regex intercepts IT-XXXX patterns
│   Bypasses LLM for known tickets│
└────────────┬────────────────────┘
             │ (No ticket match)
             ▼
┌─────────────────────────────────┐
│   AGENT 1 — Keyword Extractor   │  ← Hybrid: Regex + Meta Llama 3.3 70B
│   (via NVIDIA NIM)              │    Extracts: ["battery", "TitanBook", "SYS-ERR-42"]
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Neo4j Graph Retrieval         │  ← Cypher query: 1-2 hop traversal
│   MATCH (n:Entity)...           │    Returns typed relationship triples
│   WHERE toLower(n.name) CONTAINS│
└────────────┬────────────────────┘
             │ graph_context string
             ▼
┌─────────────────────────────────┐
│   Semantic Cache Check          │  ← MD5(system_prompt + user_msg)
│   Upstash Redis GET             │    HIT: return instantly (<5ms)
└────────────┬────────────────────┘
             │ MISS
             ▼
┌─────────────────────────────────┐
│   Primary LLM — OpenRouter Free │  ← 3 retries with exponential backoff
│   Fallback: NVIDIA NIM Llama    │    Auto hot-swap on primary failure
│   3.3 70B Instruct              │
└────────────┬────────────────────┘
             │
             ▼
        Cache Write (TTL: 24h)
        Neo4j Memory Persist
        Response → Frontend
```

### Knowledge Ingestion Pipeline

```
Admin Uploads PDF
        │
        ▼
FastAPI saves to /enterprise_manuals/
BackgroundTasks.add_task(run_daily_ingestion)
        │
        ▼
pypdf  → Extracts raw text (up to 20 pages)
        │
        ▼
Chunker → 4,000-character overlapping blocks
        │
        ▼
Meta Llama 3.3 70B (NVIDIA NIM)
        │ Extracts JSON triples:
        │ {"source": "TitanBook", "relation": "HAS_ERROR", "target": "SYS-ERR-42"}
        ▼
Neo4j MERGE (n:Entity)--[:RELATES_TO]->(m:Entity)
        │
        ▼
File renamed to .processed (idempotent)
        │
        ▼
Frontend polling detects status: "idle" → Graph auto-refreshes
```

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** + **Vite** | Core SPA framework with HMR and PWA support |
| **react-router-dom v7** | Client-side routing and protected route guards |
| **framer-motion** | Smooth animated state transitions across all UI components |
| **force-graph** | High-performance canvas-based knowledge graph visualization |
| **lucide-react** | Consistent, lightweight icon system |
| **CSS Variables** | Global design token system for glassmorphic light/dark theming |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance async ASGI server with automatic OpenAPI docs |
| **APScheduler** | Background scheduler for 24-hour automated ingestion cycles |
| **pypdf** | PDF text extraction from enterprise manuals |
| **tenacity** | Exponential backoff retry logic for resilient LLM calls |
| **python-dotenv** | Environment variable management |

### Database & Caching
| Technology | Purpose |
|---|---|
| **Neo4j AuraDB** | Cloud-managed graph database for knowledge and conversation storage |
| **Upstash Serverless Redis** | HTTP-native semantic cache with TTL management |

### AI & External Services
| Service | Role |
|---|---|
| **Meta Llama 3.3 70B** (NVIDIA NIM) | Primary: Knowledge graph extraction; Fallback: Chat inference |
| **OpenRouter (Free Auto-Router)** | Primary inference provider for chat with automatic model selection |
| **Tavily Search API** | Real-time web fallback when graph context is unavailable |

---

## 📂 Project Structure

```
GraphSentinel/
├── enterprise_backend.py     # Main FastAPI server — full agentic pipeline
├── ingestion.py              # PDF → Llama 3.3 → Neo4j ETL pipeline
├── build_knowledge_graph.py  # Offline graph seeding utility
├── evaluate_rag.py           # RAG evaluation framework (ROUGE/accuracy)
├── evaluation_report.csv     # Ground truth evaluation results
├── ground_truth.csv          # Evaluation dataset
├── enterprise_manuals/       # Drop zone for incoming PDF manuals
├── requirements.txt
│
└── enterprise-support-portal/   # Vite + React frontend
    └── src/
        ├── App.jsx               # Root router and chat shell
        ├── components/
        │   ├── AdminDashboard.jsx   # Graph viz + ingestion + cache controls
        │   ├── AdminLogin.jsx       # Glassmorphic auth screen
        │   ├── ProtectedRoute.jsx   # sessionStorage auth guard
        │   ├── Header.jsx           # System status + admin nav link
        │   ├── Sidebar.jsx          # Session history panel
        │   ├── ChatWindow.jsx       # Message rendering
        │   ├── ChatInput.jsx        # Input + submit with streaming states
        │   ├── RuixenBackground.jsx # WebGL shader background animation
        │   └── ThemeToggle.jsx      # Light/dark mode controller
        ├── hooks/
        │   └── useChat.js           # Core chat state and session management
        └── utils/
            └── ollamaApi.js         # Health check and API utilities
```

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm
- A running Neo4j AuraDB instance (free tier works)
- API keys for: Upstash, NVIDIA NIM, OpenRouter, Tavily

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/graphsentinel.git
cd graphsentinel
cp .env.example .env
# Fill in your credentials in .env before proceeding
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
python enterprise_backend.py
# Server will be live at http://127.0.0.1:8000
```

### 3. Frontend Setup

```bash
cd enterprise-support-portal

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
# App will be live at http://localhost:5173
```

### 4. Access the Application

| Interface | URL | Credentials |
|---|---|---|
| **Chat Portal** | `http://localhost:5173` | — |
| **Admin Console** | `http://localhost:5173/admin` | Password: `admin123` (configurable) |
| **API Docs** | `http://localhost:8000/docs` | — |

---

## 🔑 Environment Variables

Create a `.env` file in the project root with the following keys:

```dotenv
# ─── Neo4j AuraDB ────────────────────────────────────────────────────────────
NEO4J_URI_MAIN=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME_MAIN=neo4j
NEO4J_PASSWORD_MAIN=your_neo4j_password

# ─── Upstash Serverless Redis ─────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://YOUR_UPSTASH_ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# ─── NVIDIA NIM (Llama 3.3 70B) ──────────────────────────────────────────────
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── OpenRouter (Primary Inference) ──────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Tavily (Web Search Fallback) ────────────────────────────────────────────
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Frontend (Vite) ─────────────────────────────────────────────────────────
# For local development:
VITE_API_BASE_URL=http://127.0.0.1:8000
# For production (point to your Render backend URL):
# VITE_API_BASE_URL=https://your-app.onrender.com

# ─── Admin Dashboard ─────────────────────────────────────────────────────────
# Change this before deploying to production!
VITE_ADMIN_PASSWORD=admin123
```

> **⚠️ Security Note:** Never commit your `.env` file. It is already listed in `.gitignore`. For production deployments, configure these values through your hosting platform's environment variable dashboard.

---

## ☁️ Deployment Architecture

GraphSentinel is architected for **zero-cost cloud deployment** using modern ephemeral compute platforms:

### Frontend — Vercel Edge Network
The React/Vite application is deployed as a **Progressive Web App (PWA)** to Vercel's global edge network.
- Automatic CI/CD on every `git push` to `main`
- Static assets served from edge nodes closest to the user for sub-100ms TTFB globally
- Environment variables (`VITE_API_BASE_URL`, `VITE_ADMIN_PASSWORD`) configured in the Vercel project dashboard

### Backend — Render ASGI Server
The FastAPI backend is deployed as a persistent **Web Service** on Render's free tier.
- Uvicorn ASGI server handles concurrent async requests natively
- APScheduler runs the 24-hour ingestion cycle as a background thread within the same process
- Stateless design (all state in Neo4j/Redis) means the service survives Render's cold-start spin-downs gracefully

```
Browser
   │
   ▼
Vercel CDN (React PWA)
   │
   │ API Calls (HTTPS)
   ▼
Render (FastAPI + Uvicorn)
   ├──▶ Neo4j AuraDB (Singapore)   [Graph Storage + Memory]
   ├──▶ Upstash Redis (Global)     [Semantic Cache]
   ├──▶ NVIDIA NIM API             [LLM Inference]
   └──▶ OpenRouter / Tavily        [Fallback Inference + Web Search]
```

---

## 📊 Evaluation & Results

The system was evaluated against a curated dataset of 50 enterprise IT troubleshooting queries in `ground_truth.csv`, comparing three approaches:

| Method | Accuracy | Avg. Latency | Hallucination Rate |
|---|---|---|---|
| Zero-Shot LLM (GPT-3.5) | 61% | 2,100ms | High |
| Vector RAG (ChromaDB) | 74% | 890ms | Medium |
| **GraphSentinel (My System)** | **89%** | **< 50ms*** | **Low** |

*\* On semantic cache hit. Cold inference: ~2,400ms.*

Full evaluation results are available in [`evaluation_report.csv`](./evaluation_report.csv).

---

## 🔭 Future Work

- [ ] **WebSocket Streaming** — Stream LLM tokens to the frontend in real-time for perceived latency reduction
- [ ] **RBAC Admin Roles** — Multi-tier admin access with JWT-based authentication replacing `sessionStorage`
- [ ] **Graph Node Editor** — Allow admins to manually add, edit, or delete specific nodes and relationships from the visualizer
- [ ] **SSE Ingestion Progress** — Replace the polling mechanism with Server-Sent Events for real-time ingestion progress updates
- [ ] **Multi-tenant Sessions** — Extend the session model to support organizational team namespacing

---

## 👨‍💻 Author

**[V. K. Shivaang Simha]**
B.Tech — Artifical Intelligence & Data Science (2022-2026)
*[SMIT]*

[![GitHub](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/Sunngttssu)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/v-k-shivaang-simha-b81207246/)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

*Built with ❤️ as a final-year major project in the pursuit of making enterprise AI truthful, fast, and reliable.*

</div>
