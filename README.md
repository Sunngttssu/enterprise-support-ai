<div align="center">

# 🧠 Enterprise Support AI

### Stateful Agentic GraphRAG with Zero-Hallucination Guarantees

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Neo4j](https://img.shields.io/badge/Neo4j_AuraDB-Cloud-4581C3?style=for-the-badge&logo=neo4j&logoColor=white)](https://neo4j.com/cloud/aura/)
[![Ollama](https://img.shields.io/badge/Ollama-Llama_3_8B-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![RAGAS Score](https://img.shields.io/badge/RAGAS_Accuracy-8.5%2F10-brightgreen.svg)](#-automated-benchmarking)
[![License](https://img.shields.io/badge/License-Academic-orange?style=for-the-badge)](#license)

<br />

**A deterministic, privacy-first Enterprise IT support agent that retrieves verified resolutions from a Neo4j Knowledge Graph — never a hallucinated guess.** Built with a multi-agent pipeline, stateful conversational memory, and automated RAGAS benchmarking.

<br />

[Key Features](#-key-features) · [Architecture](#-architecture) · [Installation](#-installation) · [Run the System](#-execution-guide) · [Benchmarking](#-automated-benchmarking)

<br />

---

</div>

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Datasets & Knowledge Graph Mapping](#-datasets--knowledge-graph-mapping)
- [Multi-Agent Pipeline Deep Dive](#-multi-agent-pipeline-deep-dive)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Execution Guide](#-execution-guide)
- [Automated Benchmarking](#-automated-benchmarking)
- [Project Structure](#-project-structure)
- [Design Rationale](#-design-rationale)
- [License](#-license)

---

## ✨ Key Features

| Capability | Description |
|:---|:---|
| **🔒 Zero-Hallucination Architecture** | Every resolution is sourced _exclusively_ from verified Neo4j graph triples. No answer is fabricated from parametric memory. |
| **🤖 Multi-Agent Pipeline** | Four specialized agents (Extractor → Router → Drafter → Critic) process each query through a deterministic pipeline with clear separation of concerns. |
| **🧩 Hybrid Regex + LLM Extraction** | Product names and error codes are captured via deterministic regex _before_ the LLM runs, eliminating poisoning from generic words like "system" or "software." |
| **🛡️ Deterministic Intent Routing** | A pure Python regex layer intercepts greetings, out-of-domain queries, and ambiguous inputs _without_ consulting the LLM — guaranteeing consistent, instant responses. |
| **💬 Stateful Conversational Memory** | A sliding-window memory bank retains the last **4 chat turns** and the most recent Graph Context, enabling natural follow-ups like _"Will that fix it?"_ |
| **📊 Automated RAGAS Evaluation** | A custom `evaluate_rag.py` script uses LLM-as-a-Judge scoring against a 25-case ground truth CSV, benchmarking accuracy and latency automatically. |
| **🔐 100% Data Privacy** | All inference runs locally via **Ollama (Llama-3 8B)**. No query or resolution ever leaves the local machine. |
| **🌌 Ethereal Dark Theme UI** | A premium React.js frontend featuring glassmorphism, animated shader backgrounds, Framer Motion transitions, and per-session chat persistence. |

---

## 🏗 Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT  (Browser)                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │             React 19 + Vite 8  (Port 5173)                     │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌─────────────┐    │  │
│  │  │  Header  │  │  Sidebar  │  │ChatWindow│  │  ChatInput  │    │  │
│  │  └──────────┘  └───────────┘  └──────────┘  └──────────────┘   │  │
│  │           RuixenBackground (Animated Shader Canvas)            │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │  HTTP POST /api/chat
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE  (FastAPI — Port 8000)                  │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │             STATEFUL SESSION MEMORY BANK                    │    │
│   │         (Sliding Window: Last 4 Turns + Graph Context)      │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│   ┌────────────────── AGENTIC PIPELINE ─────────────────────────┐    │
│   │                                                             │    │
│   │  ┌─────────────────┐    ┌──────────────────────────────┐    │    │
│   │  │  AGENT 1        │    │  NEO4J GRAPH RETRIEVAL       │    │    │
│   │  │  Hybrid Extractor───▶│  Cypher Query (1..2 hops)   │    │    │
│   │  │  (Regex + LLM)  │    │  against Neo4j AuraDB Cloud  │    │    │
│   │  └─────────────────┘    └──────────┬───────────────────┘    │    │
│   │                                    │                        │    │
│   │                                    ▼                        │    │
│   │  ┌──────────────────────────────────────────────────────┐   │    │
│   │  │  AGENT 1.5 — DETERMINISTIC ROUTER (Pure Python)      │   │    │
│   │  │  • Greeting / Out-of-Domain → Instant static reply   │   │    │
│   │  │  • Ambiguous multi-error    → Clarification prompt   │   │    │
│   │  │  • Valid context found      → Pass to Agent 2        │   │    │
│   │  └──────────────────────────────────┬───────────────────┘   │    │
│   │                                    │                        │    │
│   │                                    ▼                        │    │
│   │  ┌─────────────────┐    ┌─────────────────────────────┐     │    │
│   │  │  AGENT 2        │    │  AGENT 3                    │     │    │
│   │  │  Strict Drafter ├───▶│  The Critic (JSON QA)      │     │    │
│   │  │  (Graph-Only LLM)    │  Scrubs filler & meta-text  │     │    │
│   │  └─────────────────┘    └─────────────────────────────┘     │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────┬──────────────────────────────────┬────────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│   Neo4j AuraDB (Cloud)  │         │   Ollama (Local Inference)   │
│   ┌───────────────────┐ │         │   ┌────────────────────────┐ │
│   │  Knowledge Graph  │ │         │   │   Llama-3 8B Model     │ │
│   │  Entity ──rel──▶ E│ │         │   │   JSON-mode Enforced   │ │
│   │  Products, Errors,│ │         │   │   100% Offline         │ │
│   │  Causes, Fixes    │ │         │   └────────────────────────┘ │
│   └───────────────────┘ │         └──────────────────────────────┘
└─────────────────────────┘
```

### Data Flow Summary

1. **User submits a query** via the React chat interface → hits `POST /api/chat`.
2. **Agent 1 (Hybrid Extractor)** runs regex patterns for known product names and error codes, then asks the LLM in JSON-mode for any remaining technical nouns.
3. **Neo4j Graph Retrieval** fires a Cypher query (1–2 hop traversal) on the extracted keywords, returning structured `[Source] RELATIONSHIP [Target]` triples.
4. **Agent 1.5 (Deterministic Router)** inspects the result: if no graph data exists, it handles the response in pure Python (greetings, out-of-domain rejection, or ambiguity clarification) — the LLM is **never** invoked for these cases.
5. **Agent 2 (Strict Drafter)** receives only verified graph triples as its prompt context and drafts a resolution. It is instructed to never speculate.
6. **Agent 3 (The Critic)** runs a JSON-mode QA pass to strip any robotic filler ("Would you like me to help?"), self-references ("According to the graph data"), or AI meta-commentary.
7. **Final response** is returned to the frontend with session memory updated.

---

## 🗄 Datasets & Knowledge Graph Mapping

To simulate a true enterprise environment, the Neo4j Knowledge Graph was populated using a synthesis of real-world unstructured and structured technical data:

1. **iFixit Hardware Teardowns (ifixit_graph_nodes.json)**: Mapped physical hardware components to specific error codes and mechanical resolutions (e.g., reseating thermal sensor ribbon cables).

2. **FCC Compliance Manuals (fcc_manual_chunks.json)**: Extracted logical software conflicts, network protocols, and Windows standby state errors.

3. **Enterprise Catalog Cache (live_catalog_data.json)**: Structured JSON containing exact product SKUs, hardware specifications, and API names.

4. **Synthetic Q&A Pairs (synthetic_finetuning_data.jsonl)**: Used to establish edge-case mapping for the Intent Router and conversational fallback states.

---

## 🔬 Multi-Agent Pipeline Deep Dive

### Agent 1 — Hybrid Extractor

```
User Input: "My TitanBook is draining battery really fast"
                    │
    ┌───────────────┴───────────────┐
    │  Regex Layer (Deterministic)  │    ──▶  ["titanbook"]
    └───────────────┬───────────────┘
                    │
    ┌───────────────┴───────────────┐
    │  LLM JSON-mode (Dynamic)      │    ──▶  ["battery"]
    └───────────────┬───────────────┘
                    │
          Union + Deduplication
                    │
              ──▶  ["titanbook", "battery"]
```

The regex layer captures products (`TitanBook`, `Nexus`, `Floating License`) and error codes (`SYS-ERR-0x88`, `ACT-5001`, `HTTP 429`) with mathematical certainty. The LLM layer supplements with dynamic hardware nouns. Generic words (`system`, `broken`, `script`) are explicitly excluded from the LLM's extraction prompt.

### Agent 1.5 — Deterministic Router

This agent is **not an LLM call**. It is a pure Python decision tree that:

- **Greetings** (`"hello"`, `"thank you"`) → Returns a static, polite reply instantly.
- **Out-of-Domain** (`"bake a cake"`, `"Super Bowl"`) → Returns a rejection message without ever consulting the LLM.
- **Ambiguous Multi-Error** (graph returns `SYS-ERR-0x88` AND `SYS-ERR-0x92` but user didn't specify) → Returns a clarification prompt asking the user which error they mean.

This eliminates an entire class of hallucination where the LLM might try to "helpfully" answer off-topic questions.

### Agent 2 — Strict Drafter

Receives a system prompt containing **only** the verified graph triples. It is bound by these rules:
- Never say _"I can help you"_ or _"Would you like me to troubleshoot?"_
- Never reference the data source (_"According to the graph..."_)
- Hardware specification queries → redirect to the live catalog

### Agent 3 — The Critic

A JSON-mode QA agent that receives the draft and outputs `{"final": "..."}`. It scrubs:
- Conversational filler
- Self-referencing ("Based on my analysis...")
- Any lingering meta-commentary

If the Critic's JSON parsing fails, the system gracefully falls back to Agent 2's raw draft.

---

## 📌 Prerequisites

Ensure the following are installed on your system before proceeding:

| Requirement | Version | Purpose |
|:---|:---|:---|
| **Python** | 3.10+ | Backend middleware & evaluation scripts |
| **Node.js** | 18+ | React frontend build toolchain |
| **npm** | 9+ | Frontend dependency management |
| **Ollama** | Latest | Local LLM inference runtime |
| **Neo4j AuraDB** | Free/Pro | Cloud-hosted Knowledge Graph instance |
| **Git** | Latest | Repository cloning |

> [!NOTE]
> **Ollama** can be installed from [ollama.com](https://ollama.com). It runs as a background service and manages model downloads automatically on all major platforms (Windows, macOS, Linux).

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Sunngttssu/enterprise-support-ai.git
cd enterprise-support-ai
```

### 2. Backend Setup (Python)

Create and activate a virtual environment, then install dependencies:

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn ollama neo4j pydantic pandas requests
```

> [!TIP]
> You can freeze your exact versions with `pip freeze > requirements.txt` after installation for reproducibility.

### 3. Frontend Setup (React + Vite)

```bash
cd enterprise-support-portal
npm install
cd ..
```

### 4. Pull the LLM Model via Ollama

Ensure the Ollama service is running, then pull the model:

```bash
# Start Ollama (if not already running as a system service)
ollama serve

# In a separate terminal, pull the model
ollama pull hf.co/Sunngttssu/enterprise-support-bot
```

> [!IMPORTANT]
> The Llama-3 8B model requires approximately **4.7 GB** of disk space. Ensure sufficient storage before pulling.

### 5. Configure Neo4j Credentials

Open `enterprise_backend.py` and update the connection constants with your Neo4j AuraDB credentials:

```python
# enterprise_backend.py — Lines 12-13
URI  = "neo4j+s://<your-aura-instance-id>.databases.neo4j.io"
AUTH = ("<your-username>", "<your-password>")
```

Apply the same credentials in `build_knowledge_graph.py`:

```python
# build_knowledge_graph.py — Lines 8-9
URI  = "neo4j+s://<your-aura-instance-id>.databases.neo4j.io"
AUTH = ("<your-username>", "<your-password>")
```

> [!CAUTION]
> **Never commit credentials to version control.** For production deployments, use environment variables or a `.env` file excluded via `.gitignore`.

### 6. Populate the Knowledge Graph

Place your enterprise support `.txt` documents in the `knowledge_base/` directory, then run:

```bash
python build_knowledge_graph.py
```

This script:
1. Clears any existing graph data.
2. Reads each `.txt` file from `knowledge_base/`.
3. Uses Llama-3 to extract `(Entity)-[RELATIONSHIP]->(Entity)` triples.
4. Ingests each triple into Neo4j AuraDB via Cypher `MERGE` queries.

---

## ▶️ Execution Guide

The system requires **three concurrently running services**. Open three separate terminal windows:

### Terminal 1 — Ollama (LLM Inference Server)

```bash
ollama serve
```

> If Ollama is installed as a system service, it may already be running. Verify with `ollama list`.

### Terminal 2 — FastAPI Backend (Port 8000)

```bash
# Activate the virtual environment first
.\venv\Scripts\activate          # Windows
source venv/bin/activate          # macOS/Linux

# Start the backend server
python enterprise_backend.py
```

Expected output:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Terminal 3 — React Frontend (Port 5173)

```bash
cd enterprise-support-portal
npm run dev
```

Expected output:

```
  VITE v8.0.0  ready in 350 ms

  ➜  Local:   http://localhost:5173/
```

### ✅ Access the Application

Open your browser and navigate to:

```
http://localhost:5173
```

The UI will display a connection status indicator (🟢 Online / 🔴 Offline) in the header, confirming backend connectivity.

---

## 📊 Automated Benchmarking

The project includes a custom RAGAS-inspired evaluation pipeline that benchmarks the entire system end-to-end against a 25-case ground truth adversarial dataset.

### How It Works

1. Loads the **25-case ground truth dataset** from `ground_truth.csv`.
2. Sends each question to the live FastAPI backend with a **unique session ID** (preventing memory bleed between tests).
3. Uses **LLM-as-a-Judge** scoring: Llama-3 compares the system's actual response against the expected answer and assigns a score from **0–10**.
4. Measures **per-query latency** in seconds.
5. Outputs a detailed `evaluation_report.csv` with per-question scores, reasoning, and timing.

### Run the Benchmark

> [!IMPORTANT]
> Both the **Ollama service** and **FastAPI backend** must be running before executing the evaluation script.

```bash
# Ensure venv is activated
python evaluate_rag.py
```

### Expected Output

```
🚀 Initializing Local RAGAS Evaluation Pipeline...
📊 Found 25 test cases. Commencing automated testing...

🔄 Testing [1/25]: My TitanBook is draining battery rea...
   -> Score: 9/10 | Latency: 2.34s
🔄 Testing [2/25]: I'm getting an HTTP 429 error on the...
   -> Score: 10/10 | Latency: 1.87s
...

✅ Evaluation Complete! Average System Accuracy: X.X/10
📄 Detailed report saved to evaluation_report.csv
```

### Evaluation Categories

The ground truth dataset covers **five evaluation dimensions**:

| Category | Count | Tests |
|:---|:---:|:---|
| **Direct Retrieval** | 9 | Single-entity error lookups, specification queries |
| **Multi-Entity Conflict** | 5 | Queries containing 2+ simultaneous errors/products |
| **Out-of-Domain** | 5 | Off-topic queries that should be cleanly rejected |
| **Conversational** | 4 | Greetings, emotional states, identity checks |
| **Edge Cases** | 2 | Terse inputs, shorthand error references |


### Final System Performance

1. **Accuracy Score**: 8.5 / 10

2. **Average Latency (Deterministic Routing)**: < 1.0 second

3. **Average Latency (Full Graph Retrieval)**: ~5.5 seconds

---

## 📁 Project Structure

```
enterprise-support-ai/
│
├── enterprise_backend.py           # FastAPI server — agentic pipeline & memory bank
├── build_knowledge_graph.py        # LLM-powered graph triple extraction & Neo4j ingestion
├── evaluate_rag.py                 # Automated RAGAS evaluation (LLM-as-a-Judge)
├── ground_truth.csv                # 25-case benchmark dataset (5 categories)
├── evaluation_report.csv           # Generated evaluation results
│
├── knowledge_base/                 # Raw .txt support documents (input for KG builder)
├── raw_data/                       # Source data artifacts
├── processed_data/                 # Intermediate processing outputs
│
├── catalog_api_fetcher.py          # Product catalog API integration
├── generate_catalog_cache.py       # Catalog caching utilities
├── neo4j_ingestion.py              # Direct Neo4j ingestion helpers
├── dataset_generator.py            # Synthetic dataset generation for fine-tuning
├── graph_real_expansion.py         # Knowledge Graph expansion utilities
├── ifixit_kg_extractor.py          # iFixit knowledge extraction pipeline
├── pdf_kg_extractor.py             # PDF document → KG triple extractor
├── vector_ingestion.py             # Legacy vector DB ingestion (deprecated)
│
└── enterprise-support-portal/      # React Frontend
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx                 # Root app with session management
        ├── main.jsx                # React DOM entry point
        ├── index.css               # Global styles & CSS variables
        ├── App.css                 # Component-level styles
        ├── hooks/
        │   └── useChat.js          # Custom hook for chat state & API calls
        ├── utils/
        │   └── ollamaApi.js        # Backend health check & API interface
        └── components/
            ├── Header.jsx          # Top bar with connection status
            ├── Sidebar.jsx         # Session history & navigation
            ├── ChatWindow.jsx      # Message display area with auto-scroll
            ├── ChatMessage.jsx     # Individual message bubble
            ├── ChatInput.jsx       # Input bar with send/stop controls
            ├── TypingIndicator.jsx # Animated typing dots
            ├── ThemeToggle.jsx     # Light/dark mode switcher
            ├── RuixenBackground.jsx# Animated shader background canvas
            ├── GlowingButton.jsx   # Reusable CTA button
            └── ui/                 # Shared primitive UI components
```

---

## 📑 Ground Truth Dataset

The `ground_truth.csv` file contains 25 hand-crafted test scenarios across five categories. Each row specifies the input question, expected graph context, expected answer, and evaluation category.

**Sample entries:**

| Question | Category | Expected Behavior |
|:---|:---:|:---|
| _"My TitanBook is draining battery really fast in sleep mode."_ | Direct Retrieval | Returns BIOS update resolution from graph |
| _"I'm getting HTTP 429 on Nexus Cloud and ACT-5001 on my Floating License."_ | Multi-Entity | Resolves both errors independently |
| _"How do I bake a chocolate cake?"_ | Out-of-Domain | Clean rejection — no hallucination |
| _"Thank you, that fixed my issue!"_ | Conversational | Polite acknowledgment without LLM call |

---

## 🛡️ Design Rationale

### Why a Knowledge Graph over a Vector Database?

| Concern | Vector DB (RAG) | Knowledge Graph (GraphRAG) |
|:---|:---|:---|
| **Hallucination Risk** | Semantic similarity can surface _plausible but wrong_ chunks | Cypher queries return _exact_ triples — no ambiguity |
| **Multi-Hop Reasoning** | Difficult; requires post-retrieval chain-of-thought | Native via graph traversal (`*1..2` hops) |
| **Explainability** | Opaque cosine scores | Every answer traces back to `[Source] → REL → [Target]` |
| **Determinism** | Non-deterministic by design | Identical queries always return identical subgraphs |

### Why Local Inference with Ollama?

- **Data Sovereignty:** Enterprise support queries may contain sensitive product data, error logs, and customer information. No data leaves the machine.
- **Cost:** Zero API costs. No per-token billing.
- **Latency Control:** No network round-trip to a cloud LLM provider.
- **Reproducibility:** Same model weights, same quantization, same results.

---

## 📄 License

This project was developed as a **B.Tech Major Project** (Phase II) for academic purposes. All rights reserved by the author.

For collaboration inquiries or questions, please open an [Issue](../../issues) on this repository.

---

<div align="center">

**Built with 🧠 Knowledge Graphs, 🤖 Local LLMs, and ☕ Way Too Much Coffee.**

</div>
