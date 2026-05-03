<div align="center">

# 🛡️ GraphSentinel

### Agentic GraphRAG Enterprise Customer Support Platform

**A production-grade, cloud-deployed AI support system powered by Knowledge Graphs, a custom fine-tuned Llama-3 model, and a multi-agent agentic pipeline.**

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-graphsentinel.vercel.app-6366f1?style=for-the-badge)](https://graphsentinel.vercel.app/)
[![Backend API](https://img.shields.io/badge/⚡%20Backend%20API-Render-22c55e?style=for-the-badge)](https://graphsentinel-6z2h.onrender.com)
[![Model on HuggingFace](https://img.shields.io/badge/🤗%20Model-Sunngttssu%2Fenterprise--support--bot-f59e0b?style=for-the-badge)](https://huggingface.co/Sunngttssu/enterprise-support-bot)
[![GitHub](https://img.shields.io/badge/GitHub-enterprise--support--ai-181717?style=for-the-badge&logo=github)](https://github.com/Sunngttssu/enterprise-support-ai)

</div>

---

## 🚀 Live Deployment

| Service | Platform | URL |
|---|---|---|
| 🖥️ **Frontend** | Vercel | [https://graphsentinel.vercel.app/](https://graphsentinel.vercel.app/) |
| ⚙️ **Backend API** | Render | [https://graphsentinel-6z2h.onrender.com](https://graphsentinel-6z2h.onrender.com) |
| 📡 **API Health** | Render | [https://graphsentinel-6z2h.onrender.com/api/health](https://graphsentinel-6z2h.onrender.com/api/health) |
| 🗄️ **Knowledge Graph** | Neo4j AuraDB | Cloud-hosted |
| 🤗 **Fine-tuned Model** | HuggingFace Hub | [Sunngttssu/enterprise-support-bot](https://huggingface.co/Sunngttssu/enterprise-support-bot) |

---

## 📖 Overview

**GraphSentinel** is a fully cloud-deployed, agentic AI customer support platform built for enterprise environments. Unlike traditional RAG systems that retrieve from flat vector stores, GraphSentinel is architected around a **Knowledge Graph (Neo4j AuraDB)** that captures rich semantic relationships between products, error codes, causes, and resolutions.

The platform features a **multi-agent pipeline** where specialized agents collaborate to route queries, extract entities, traverse the knowledge graph, and synthesize accurate, grounded responses — all backed by a resilient multi-model LLM aggregator powered by **OpenRouter**.

The custom **Llama-3 model** (fine-tuned via QLoRA/Unsloth) is used as the on-demand inference engine for knowledge graph construction and evaluation, while the live cloud backend uses OpenRouter for scalable, quota-free inference.

---

## ✨ Key Features

### 🤖 Agentic Multi-Agent Pipeline
- **Agent 1 — Hybrid Keyword Extractor:** Combines regex pattern matching with an LLM to extract technical entities from user queries (error codes, device names, component types).
- **Agent 1.5 — Ticket Router:** Intercepts enterprise ticket IDs (e.g., `IT-404`) before any graph traversal and instantly resolves status from the mock ticketing system.
- **Agent 2 — Master Synthesizer:** Fetches 1–2 hop graph context from Neo4j, applies a critic-verified prompt, and generates a precise, hallucination-controlled final response.

### 🕸️ GraphRAG Knowledge Architecture
- Entities and relationships (`HAS_ERROR`, `CAUSED_BY`, `RESOLVED_BY`, `HAS_GUIDE`, `REQUIRES_TOOL`) are stored as a **property graph** in Neo4j AuraDB.
- Graph traversal (1–2 hops) surfaces richer context than flat vector similarity search, enabling multi-step reasoning about device-error-fix chains.

### 🧠 Persistent Conversational Memory
- Each chat session's history is persisted directly into **Neo4j** — not in RAM or local files — making the backend fully stateless and safe for cloud environments like Render.
- The `(:Session)-[:HAS_MESSAGE]->(:Message)` graph model allows ordered retrieval of the last 4 conversation turns, injected into every system prompt.

### 🌐 Multi-Model LLM Fallback (OpenRouter)
- **Primary:** OpenRouter's dynamic free pool auto-router (`openrouter/free`) — automatically selects the best available free model.
- **Fallback:** `meta-llama/llama-3.1-8b-instruct:free` — hot-swaps instantly if the primary pool fails.
- **Web Search Fallback:** Tavily API activates for technical queries with no matching graph context.

### 📴 Offline-First PWA
- The React frontend is a **Progressive Web App (PWA)** with Workbox-powered service workers.
- When the device goes offline, queries are routed to a **Fuse.js fuzzy search** over a local `offline_graph.json` cache, ensuring the app remains usable without internet.
- The app is installable on desktop and mobile (standalone display mode).

### ⏰ Real-Time IST Clock Awareness
- The backend injects the live **Indian Standard Time (IST)** into every system prompt, enabling the AI to give contextually accurate greetings (Good Morning / Afternoon / Evening) and time-aware responses.

### 🎫 Mock Enterprise Ticketing System
- Built-in ticket lookup for IDs like `IT-404`, `IT-1001`, `IT-2233` etc., simulating integration with a real enterprise ITSM platform.

### 🏆 Custom Fine-Tuned Llama-3 Model
- A domain-specific **Llama-3** model was fine-tuned using **QLoRA** and **Unsloth** on a synthetically generated enterprise support dataset (~1,200 Q&A pairs).
- Published on HuggingFace Hub: [`Sunngttssu/enterprise-support-bot`](https://huggingface.co/Sunngttssu/enterprise-support-bot).
- Used locally via **Ollama** for knowledge graph construction (`build_knowledge_graph.py`) and RAGAS-style evaluation (`evaluate_rag.py`).

---

## 🛠️ Tech Stack

### Frontend
| Technology | Role |
|---|---|
| ⚛️ **React 19** + **Vite 8** | Core UI framework with fast HMR |
| 🎨 **Tailwind CSS v4** | Utility-first styling |
| 🎞️ **Framer Motion** | Micro-animations and transitions |
| 🔍 **Fuse.js** | Offline fuzzy search over the local knowledge cache |
| 🖱️ **Lucide React** | Icon library |
| 📦 **vite-plugin-pwa** | Progressive Web App manifest and Workbox service worker |

### Backend
| Technology | Role |
|---|---|
| ⚡ **FastAPI** | Async REST API framework |
| 🕸️ **Neo4j AuraDB** + `langchain-neo4j` | Cloud graph database for knowledge storage and persistent memory |
| 🤖 **OpenRouter API** + `openai` SDK | Multi-model LLM aggregator with automatic fallback |
| 🌐 **Tavily API** | Real-time web search for queries not found in the graph |
| 🧬 **LangGraph** | Agentic workflow orchestration |
| 📊 **Sentence Transformers** | Embedding generation for semantic similarity |
| 🦙 **Ollama** (local only) | Runtime for the custom fine-tuned Llama-3 model |
| 🐍 **Uvicorn** | ASGI server for production deployment |

### MLOps & Data Pipeline
| Technology | Role |
|---|---|
| 🤗 **Transformers** + **PEFT** | QLoRA fine-tuning infrastructure |
| ⚡ **Unsloth** | Fast QLoRA fine-tuning optimizer |
| 🦙 **Ollama** (local) | Dataset generation and RAG evaluation inference engine |
| 🗃️ **ChromaDB** | Vector store (used in pipeline experimentation) |
| 📐 **LangChain** | Document processing and chain composition |
| 📊 **Pandas** + **Matplotlib** | Evaluation metrics and reporting |

### Infrastructure
| Service | Platform |
|---|---|
| 🖥️ Frontend Hosting | Vercel |
| ⚙️ Backend Hosting | Render |
| 🗄️ Graph Database | Neo4j AuraDB (Free Tier) |
| 🤗 Model Registry | HuggingFace Hub |

---

## 📁 Repository Structure

```
enterprise-support-ai/
│
├── 📁 enterprise-support-portal/      # React + Vite Frontend (→ Vercel)
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   │   ├── ChatInput.jsx          # Message input bar with stop button
│   │   │   ├── ChatMessage.jsx        # Individual message bubble (user/AI)
│   │   │   ├── ChatWindow.jsx         # Scrollable message viewport
│   │   │   ├── GlowingButton.jsx      # Reusable animated CTA button
│   │   │   ├── Header.jsx             # Top bar with system status indicator
│   │   │   ├── RuixenBackground.jsx   # WebGL/SVG animated background shader
│   │   │   ├── Sidebar.jsx            # Multi-session conversation list
│   │   │   ├── ThemeToggle.jsx        # Light/dark glassmorphism theme switcher
│   │   │   └── TypingIndicator.jsx    # Animated "AI is thinking" indicator
│   │   ├── 📁 hooks/
│   │   │   └── useChat.js             # Core chat logic: online/offline routing, Fuse.js
│   │   ├── 📁 utils/
│   │   │   └── ollamaApi.js           # Fetch wrapper for the FastAPI backend
│   │   ├── App.jsx                    # Root component, session management (localStorage + Neo4j)
│   │   ├── main.jsx                   # React DOM entry point
│   │   └── index.css                  # Global design tokens and animations
│   ├── vite.config.js                 # Vite + PWA + TailwindCSS config
│   └── package.json
│
├── 🐍 enterprise_backend.py          # FastAPI backend — agentic pipeline (→ Render)
│
├── 🔧 Data Pipeline Scripts (local / one-time)
│   ├── build_knowledge_graph.py      # Extracts entities via local Llama-3, pushes to Neo4j
│   ├── neo4j_ingestion.py            # Pushes structured iFixit guide data into Neo4j
│   ├── catalog_api_fetcher.py        # Scrapes product catalog data from external APIs
│   ├── generate_catalog_cache.py     # Pre-generates the offline_graph.json for the PWA
│   ├── ifixit_kg_extractor.py        # Extracts guide data from the iFixit API
│   ├── graph_real_expansion.py       # Expands the knowledge graph with additional nodes
│   ├── pdf_kg_extractor.py           # Extracts entity triples from PDF manuals
│   ├── dataset_generator.py          # Generates synthetic QLoRA fine-tuning data via Ollama
│   ├── vector_ingestion.py           # Ingests document chunks into ChromaDB
│   └── evaluate_rag.py               # RAGAS-style LLM-as-a-judge evaluation pipeline
│
├── 📁 knowledge_base/                 # Source .txt documents for graph construction
├── 📁 processed_data/                 # Processed JSON chunks and JSONL training data
├── 📁 raw_data/                       # Original raw documents and manuals
├── 📁 chroma_db_export/               # Exported ChromaDB vector store (gitignored)
│
├── ground_truth.csv                   # Hand-labeled Q&A pairs for evaluation
├── evaluation_report.csv              # Auto-generated RAGAS evaluation results
├── requirements.txt                   # Python backend dependencies (pinned)
└── .gitignore
```

---

## 🔄 System Architecture

```
User Browser (PWA)
        │
        ▼
┌──────────────────────────────────┐
│   React + Vite Frontend          │
│   (Vercel — graphsentinel.vercel.app) │
│                                  │
│  • Multi-session Sidebar          │
│  • LocalStorage session cache     │
│  • Fuse.js offline fallback       │
│  • PWA + Workbox service worker   │
└─────────────┬────────────────────┘
              │  POST /api/chat
              │  GET  /api/health
              ▼
┌──────────────────────────────────┐
│   FastAPI Backend                │
│   (Render — graphsentinel-6z2h.onrender.com) │
│                                  │
│  ┌─────────────────────────┐     │
│  │  Agent 1.5: Ticket Router│     │
│  │  (regex → MOCK_TICKETS)  │     │
│  └───────────┬─────────────┘     │
│              │ (no ticket)        │
│  ┌───────────▼─────────────┐     │
│  │  Agent 1: Keyword        │     │
│  │  Extractor (Regex + LLM) │     │
│  └───────────┬─────────────┘     │
│              │                   │
│  ┌───────────▼─────────────┐     │
│  │  Neo4j Graph Traversal   │◄────┼──── Neo4j AuraDB
│  │  (1-2 hop Cypher query)  │     │     (Knowledge Graph
│  └───────────┬─────────────┘     │      + Session Memory)
│              │                   │
│  ┌───────────▼─────────────┐     │
│  │  Agent 2: Master LLM     │     │
│  │  (OpenRouter primary →   │     │
│  │   Llama-3.1 fallback →   │     │
│  │   Tavily web search)     │     │
│  └─────────────────────────┘     │
└──────────────────────────────────┘
```

---

## ⚙️ Local Development Setup

> **Note:** The live application is fully operational at the deployment URLs above. Local setup is only needed for development or to run the data pipeline scripts with the custom Llama-3 model.

### Prerequisites

- Node.js `>= 18.x`
- Python `>= 3.10`
- [Ollama](https://ollama.com/) (required **only** for data pipeline scripts — not for the web app)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Sunngttssu/enterprise-support-ai.git
cd enterprise-support-ai
```

---

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```bash
cp .env.example .env  # or create it manually (see Environment Variables section)
```

Start the backend:

```bash
uvicorn enterprise_backend:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.
- Health check: `GET http://127.0.0.1:8000/api/health`
- Interactive docs: `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup

```bash
cd enterprise-support-portal

# Install dependencies
npm install
```

Create a `.env` file inside `enterprise-support-portal/`:

```env
# Point the frontend to your local backend during development
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> For local development against the live cloud backend, set:
> `VITE_API_BASE_URL=https://graphsentinel-6z2h.onrender.com`

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### 4. (Optional) Running the Custom Llama-3 Model Locally

The custom fine-tuned model is used for **knowledge graph construction** and **RAG evaluation** — not for the live web app (which uses OpenRouter). To run it locally:

```bash
# Pull the custom fine-tuned model from HuggingFace Hub via Ollama
ollama pull hf.co/Sunngttssu/enterprise-support-bot
```

Verify the model is available:

```bash
ollama list
# Should show: hf.co/Sunngttssu/enterprise-support-bot
```

You can then run the data pipeline scripts:

```bash
# Build / refresh the knowledge graph from .txt files in knowledge_base/
python build_knowledge_graph.py

# Generate a synthetic QLoRA fine-tuning dataset
python dataset_generator.py

# Run the LLM-as-a-Judge RAG evaluation suite
python evaluate_rag.py
```

---

## 🔑 Environment Variables

### Backend — Root `.env`

| Variable | Description | Required |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key for multi-model LLM access | ✅ Yes |
| `TAVILY_API_KEY` | Tavily API key for real-time web search fallback | ✅ Yes |
| `NEO4J_URI_MAIN` | Neo4j AuraDB connection URI (e.g. `neo4j+s://xxxx.databases.neo4j.io`) | ✅ Yes |
| `NEO4J_USERNAME_MAIN` | Neo4j AuraDB username | ✅ Yes |
| `NEO4J_PASSWORD_MAIN` | Neo4j AuraDB password | ✅ Yes |
| `NEO4J_URI_EXPANSION` | Secondary Neo4j instance URI (graph expansion scripts) | ⚠️ Optional |
| `NEO4J_USERNAME_EXPANSION` | Secondary Neo4j username | ⚠️ Optional |
| `NEO4J_PASSWORD_EXPANSION` | Secondary Neo4j password | ⚠️ Optional |

### Frontend — `enterprise-support-portal/.env`

| Variable | Description | Required |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend (no trailing slash) | ✅ Yes |

**Example (Production):**
```env
VITE_API_BASE_URL=https://graphsentinel-6z2h.onrender.com
```

**Example (Local Development):**
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> ⚠️ **Security:** Never commit `.env` files to version control. Both `.env` files are listed in `.gitignore`.

---

## 🚢 Cloud Deployment

### Frontend → Vercel

1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set the **Root Directory** to `enterprise-support-portal`.
3. Set the **Build Command** to `npm run build` and **Output Directory** to `dist`.
4. Add the environment variable:
   - `VITE_API_BASE_URL` → `https://graphsentinel-6z2h.onrender.com`
5. Deploy. Vercel auto-deploys on every push to `main`.

### Backend → Render

1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Web Service**.
3. Set **Root Directory** to `/` (the repo root).
4. Set the **Build Command** to `pip install -r requirements.txt`.
5. Set the **Start Command** to:
   ```bash
   uvicorn enterprise_backend:app --host 0.0.0.0 --port $PORT
   ```
6. Add all backend environment variables from the table above in Render's **Environment** tab.
7. Deploy.

---

## 📊 Evaluation

GraphSentinel includes a built-in **RAGAS-style** evaluation pipeline using the fine-tuned Llama-3 model as a judge.

```bash
# Requires: local backend running + Ollama with the custom model
python evaluate_rag.py
```

**Output:** `evaluation_report.csv` — a per-question report containing:
- `Score (0-10)` — LLM-as-a-Judge factual accuracy score
- `Latency (s)` — API response time per query
- `Judge Reason` — Detailed explanation of the score
- `Actual` vs `Expected` answer comparison

The evaluation uses **unique session IDs per test case** to prevent memory contamination between test runs.

---

## 🤗 Fine-Tuning Pipeline

The domain-specific Llama-3 model was trained using the following pipeline:

```
1. Raw Data Collection
   └── PDF manuals + iFixit API + product catalogs
       (pdf_kg_extractor.py, ifixit_kg_extractor.py, catalog_api_fetcher.py)

2. Data Processing
   └── Chunking → structured JSON
       (vector_ingestion.py, processed_data/)

3. Synthetic Dataset Generation
   └── Llama-3.1 (base) used as "Teacher" LLM
       → 1,200 diverse Q&A pairs in Llama-3 chat format
       (dataset_generator.py → processed_data/synthetic_finetuning_data.jsonl)

4. QLoRA Fine-Tuning (Kaggle GPU)
   └── Unsloth + PEFT + Hugging Face Trainer
       → Custom model: Sunngttssu/enterprise-support-bot

5. Knowledge Graph Construction
   └── Fine-tuned model runs locally via Ollama
       → Extracts (Entity)-[RELATIONSHIP]->(Entity) triples
       → Ingests into Neo4j AuraDB
       (build_knowledge_graph.py)
```

---

## 🔌 API Reference

Base URL: `https://graphsentinel-6z2h.onrender.com`

### `GET /api/health`
Returns the backend health status.

**Response:**
```json
{ "status": "ok" }
```

---

### `POST /api/chat`
Submits a message to the agentic pipeline.

**Request Body:**
```json
{
  "message": "My TitanBook Pro keeps shutting down. Error SYS-ERR-0042.",
  "session_id": "user-abc-123"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | — | The user's query |
| `session_id` | `string` | `"default_session"` | Unique ID for persistent Neo4j memory |

**Response:**
```json
{
  "response": "SYS-ERR-0042 on the TitanBook Pro is caused by a faulty thermal sensor triggering a forced shutdown. Resolution: ..."
}
```

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using FastAPI, React, Neo4j, and Llama-3**

[🌐 Live Demo](https://graphsentinel.vercel.app/) · [⚡ API](https://graphsentinel-6z2h.onrender.com) · [🤗 Model](https://huggingface.co/Sunngttssu/enterprise-support-bot) · [📦 GitHub](https://github.com/Sunngttssu/enterprise-support-ai)

</div>
