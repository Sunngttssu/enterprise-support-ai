from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tavily import TavilyClient
from neo4j import GraphDatabase
from openai import OpenAI
from dotenv import load_dotenv
import datetime
import pytz
import json
import re
import os

# Load the secrets from the .env file
load_dotenv()

# ==========================================
# 1. API CONNECTIONS & CONFIGURATION
# ==========================================
URI  = os.getenv("NEO4J_URI_MAIN")
AUTH = (os.getenv("NEO4J_USERNAME_MAIN"), os.getenv("NEO4J_PASSWORD_MAIN"))

# Initialize clients
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
driver = GraphDatabase.driver(URI, auth=AUTH)

# Configure the Universal OpenAI Client (Pointed at OpenRouter)
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

app = FastAPI(title="Enterprise Support API - Universal Aggregator Architecture")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default_session"

# ==========================================
# 2. REAL-TIME IST CLOCK UTILITY
# ==========================================
def get_ist_time() -> str:
    """Returns the current time in Indian Standard Time (IST), formatted for the LLM prompt."""
    ist_zone = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.datetime.now(ist_zone)
    # Using standard %I to ensure it works on both Windows (local) and Linux (Render)
    return now_ist.strftime("%A, %B %d, %Y, %I:%M %p")


# ==========================================
# 3. PERSISTENT NEO4J MEMORY (RENDER-SAFE)
# ==========================================
def save_to_memory(session_id: str, role: str, content: str) -> None:
    """
    Persists a single conversation message into Neo4j.
    Graph model: (:Session {id})-[:HAS_MESSAGE]->(:Message {role, content, timestamp})
    Messages are chained via [:NEXT] for ordered retrieval.
    """
    ist_zone = pytz.timezone("Asia/Kolkata")
    timestamp = datetime.datetime.now(ist_zone).isoformat()

    cypher = """
    MERGE (s:Session {id: $session_id})
    CREATE (m:Message {role: $role, content: $content, timestamp: $timestamp})
    CREATE (s)-[:HAS_MESSAGE]->(m)
    WITH s, m
    OPTIONAL MATCH (s)-[:HAS_MESSAGE]->(prev:Message)
    WHERE prev <> m
    WITH s, m, prev ORDER BY prev.timestamp DESC LIMIT 1
    FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
        CREATE (prev)-[:NEXT]->(m)
    )
    """
    try:
        with driver.session() as db_session:
            db_session.run(
                cypher,
                session_id=session_id,
                role=role,
                content=content,
                timestamp=timestamp,
            )
    except Exception as e:
        print(f"⚠️ Neo4j Memory Write Failed: {e}")


def get_recent_memory(session_id: str) -> str:
    """
    Fetches the last 4 conversation turns (8 messages) from Neo4j for the given session.
    Returns a formatted string for direct injection into the LLM system prompt.
    """
    cypher = """
    MATCH (s:Session {id: $session_id})-[:HAS_MESSAGE]->(m:Message)
    RETURN m.role AS role, m.content AS content, m.timestamp AS timestamp
    ORDER BY m.timestamp DESC
    LIMIT 8
    """
    try:
        with driver.session() as db_session:
            results = db_session.run(cypher, session_id=session_id)
            records = list(results)

        if not records:
            return "No prior conversation history."

        # Reverse to get chronological order (oldest → newest)
        records.reverse()
        history_lines = [f"{rec['role'].upper()}: {rec['content']}" for rec in records]
        return "\n".join(history_lines)

    except Exception as e:
        print(f"⚠️ Neo4j Memory Read Failed: {e}")
        return "History temporarily unavailable."


# ==========================================
# 4. MULTI-MODEL FALLBACK ROUTER (OPENROUTER) — UNTOUCHED
# ==========================================
def call_llm(system_prompt: str, user_message: str = "", is_json: bool = False) -> str:
    """Attempts the OpenRouter dynamic free pool, hot-swaps to Llama 3.1 if it fails."""

    messages = [{"role": "system", "content": system_prompt}]
    if user_message:
        messages.append({"role": "user", "content": user_message})

    # --- ATTEMPT 1: OpenRouter Dynamic Free Pool ---
    try:
        response = client.chat.completions.create(
            model="openrouter/free",  # <-- The magic auto-router endpoint
            messages=messages,
            temperature=0.1,
        )
        return response.choices[0].message.content

    except Exception as e1:
        print(f"⚠️ Primary Pool Failed ({e1}). Hot-swapping to Fallback Model...")

        # --- ATTEMPT 2: Fallback Free Model (Meta Llama 3.1) ---
        try:
            response = client.chat.completions.create(
                model="meta-llama/llama-3.1-8b-instruct:free",  # <-- Corrected version ID
                messages=messages,
                temperature=0.1,
            )
            return response.choices[0].message.content

        except Exception as e2:
            print(f"❌ CRITICAL: Fallback LLM also failed: {e2}")
            if is_json:
                # Provide an empty JSON structure so the extraction step doesn't crash
                return '{"keywords": [], "final": "Error connecting to AI providers."}'
            return "I am currently experiencing network latency across all AI models. Please try your request again."


# ==========================================
# MOCK ENTERPRISE TICKETING SYSTEM
# ==========================================
MOCK_TICKETS: dict[str, dict] = {
    "IT-404":  {"status": "In Progress",  "assigned_to": "L2 Support Team",   "eta": "2 business days"},
    "IT-1001": {"status": "Resolved",     "assigned_to": "Hardware Desk",      "eta": "N/A — resolved on 2026-04-20"},
    "IT-2233": {"status": "Open",         "assigned_to": "Network Operations", "eta": "Under investigation"},
    "IT-5500": {"status": "Pending User", "assigned_to": "Software Licensing", "eta": "Awaiting confirmation from requester"},
    "IT-9999": {"status": "Closed",       "assigned_to": "IT Helpdesk",        "eta": "N/A — closed on 2026-04-18"},
}

TICKET_PATTERN = re.compile(r'\bIT-\d+\b', re.IGNORECASE)

def lookup_ticket(ticket_id: str) -> str | None:
    ticket = MOCK_TICKETS.get(ticket_id.upper())
    if not ticket: return None
    return (
        f"🎫 **Ticket {ticket_id.upper()}**\n"
        f"- **Status:** {ticket['status']}\n"
        f"- **Assigned to:** {ticket['assigned_to']}\n"
        f"- **ETA / Resolution:** {ticket['eta']}"
    )


# ==========================================
# AGENT 1: REGEX-ASSISTED KEYWORD EXTRACTOR
# ==========================================
def extract_keywords(user_message: str) -> list:
    print("🤖 AGENT 1: Extracting search entities (Hybrid Mode)...")

    regex_pattern = r'(SYS-ERR-[0-9a-zA-Z]+|ACT-[0-9]+|HTTP \d+|TitanBook|Nexus|Floating|Workstation)'
    regex_keywords = [match.lower().strip() for match in re.findall(regex_pattern, user_message, re.IGNORECASE)]

    prompt = f"""
    Extract technical nouns or specific hardware components from this message: "{user_message}"
    Do NOT extract generic words like 'system', 'software', 'broken', 'cake', 'script'.
    Respond STRICTLY in JSON format. Example: {{"keywords": ["battery", "sensor"]}}
    """

    response_text = call_llm(system_prompt="You are a JSON keyword extractor.", user_message=prompt, is_json=True)
    try:
        # Clean potential markdown from response
        clean_text = response_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        llm_keywords = [str(k).lower().strip() for k in data.get("keywords", [])]
    except Exception:
        llm_keywords = []

    final_keywords = list(set(regex_keywords + llm_keywords))
    print(f"   -> Final Keywords: {final_keywords}")
    return final_keywords


# ==========================================
# NEO4J GRAPH RETRIEVAL
# ==========================================
def retrieve_graph_context(keywords: list) -> str:
    if not keywords: return ""
    query = """
    MATCH (start:Entity)
    WHERE any(kw IN $kws WHERE toLower(start.name) CONTAINS kw)
    MATCH path = (start)-[*1..2]-(connected:Entity)
    UNWIND relationships(path) as r
    RETURN DISTINCT startNode(r).name as source, type(r) as rel, endNode(r).name as target
    LIMIT 20
    """
    context_sentences = []
    with driver.session() as session:
        results = session.run(query, kws=keywords)
        for record in results:
            sentence = f"[{record['source']}] {record['rel']} [{record['target']}]."
            context_sentences.append(sentence.replace("_", " "))
    return " | ".join(context_sentences)


# ==========================================
# MAIN AGENTIC PIPELINE
# ==========================================
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    print(f"\n📩 NEW SESSION [{session_id[-4:]}]: {request.message}")

    # --- Gather live context before any logic ---
    live_time = get_ist_time()
    recent_memory = get_recent_memory(session_id)

    # Persist the incoming user message to Neo4j
    save_to_memory(session_id, "user", request.message)

    # ---- AGENT 1.5: Ticket Router ----
    ticket_matches = TICKET_PATTERN.findall(request.message)
    if ticket_matches:
        ticket_id = ticket_matches[0].upper()
        print(f"🎫 AGENT 1.5 ROUTER: Ticket number detected — {ticket_id}")
        ticket_response = lookup_ticket(ticket_id)
        if ticket_response:
            save_to_memory(session_id, "ai", ticket_response)
            return {"response": ticket_response}
        else:
            not_found = f"⚠️ Ticket **{ticket_id}** was not found in the enterprise system."
            save_to_memory(session_id, "ai", not_found)
            return {"response": not_found}

    try:
        keywords = extract_keywords(request.message)
        graph_context = retrieve_graph_context(keywords)

        # ---- BASE SYSTEM PROMPT with live IST clock + Neo4j history ----
        base_system_prompt = f"""
You are an Enterprise AI connected to a live clock. It is currently {live_time}.

If the user initiates a conversation, greet them accurately based on the 24-hour clock:
- Morning:   05:00 – 11:59
- Afternoon: 12:00 – 16:59
- Evening:   17:00 – 04:59

You have access to the user's past history:
{recent_memory}

Seamlessly weave past context into your answers without saying 'According to your history'.
"""

        # ---- No graph context → LLM handles intent (greetings + web fallback) ----
        if not graph_context:
            print("⚠️ No graph data found. Routing to LLM general handler...")

            # Check if the message is likely technical to decide between LLM chat and web search
            technical_signals = re.search(
                r'(error|fix|broken|crash|install|update|vpn|network|wifi|license|reset|battery|driver|boot|slow|screen|keyboard|mouse)',
                request.message,
                re.IGNORECASE,
            )

            if technical_signals:
                print("🌐 ROUTER: Technical intent, but local graph is empty. Triggering Tavily Web Search...")
                try:
                    search_result = tavily_client.search(query=request.message, search_depth="basic")
                    web_context = "\n".join([f"- {result['content']}" for result in search_result['results']])

                    draft_prompt = f"""{base_system_prompt}

You are a highly precise IT Support Expert.
The user is asking about: {request.message}

Answer strictly using this web data: {web_context}

STRICT RULE: Ensure you address the EXACT device mentioned by the user.
"""
                    final_text = call_llm(system_prompt=draft_prompt, user_message=request.message, is_json=False)

                except Exception as e:
                    print(f"❌ FALLBACK AGENT ERROR: {e}")
                    final_text = "I could not find this in our internal database, and the live web search failed."
            else:
                # Non-technical (greetings, chit-chat, thanks) — let the LLM handle it naturally
                general_prompt = f"""{base_system_prompt}

You are a professional Enterprise Support AI. Respond naturally and helpfully.
RULES:
1. DO NOT say "According to your history".
2. Keep responses concise and warm.
3. If the user has no technical issue, offer to help with one.
"""
                final_text = call_llm(system_prompt=general_prompt, user_message=request.message, is_json=False)

            save_to_memory(session_id, "ai", final_text)
            return {"response": final_text}

        # ---- Multi-error clarification gate ----
        error_pattern = r'(SYS-ERR-[0-9a-zA-Z]+|ACT-[0-9]+|HTTP \d+)'
        graph_errors = list(set(re.findall(error_pattern, graph_context.upper())))

        if len(graph_errors) > 1 and "spec" not in request.message.lower():
            user_specified_code = any(err.lower() in request.message.lower() for err in graph_errors)
            semantic_hints = ["battery", "sleep", "thermal", "sensor", "shutting", "shutdown", "api", "key", "license", "drain"]
            user_gave_hint = any(hint in request.message.lower() for hint in semantic_hints)

            if not user_specified_code and not user_gave_hint:
                error_list = " or ".join(graph_errors[:2])
                clarification = f"I see a few known issues for that product. Are you experiencing {error_list}?"
                save_to_memory(session_id, "ai", clarification)
                return {"response": clarification}

        # ------------------------------------------------------------------
        # STEP 4: SINGLE-PASS MASTER AGENT (Draft + Critic Combined)
        # ------------------------------------------------------------------
        print("⚡ AGENT 2: Generating final verified response...")

        master_prompt = f"""{base_system_prompt}

You are a highly efficient Enterprise IT Bot. State the resolution directly based ONLY on the provided facts.

CRITICAL RULES:
1. DO NOT say "I can help", "Would you like me to help?", or "According to the graph data".
2. DO NOT ask the user questions or offer to troubleshoot.
3. If the user asks about a SPECIFIC error, give ONLY the fix for that error.
4. Remove all conversational filler. Provide only the factual, cleaned answer.

Facts to use: {graph_context}
"""

        final_text = call_llm(system_prompt=master_prompt, user_message=request.message, is_json=False)

        # Quick manual scrub just in case the LLM disobeys the prompt
        final_text = final_text.replace("According to the graph data,", "").strip()

        print("✅ SYSTEM: Final response sent to UI.")
        save_to_memory(session_id, "ai", final_text)

        return {"response": final_text}

    except Exception as e:
        print(f"❌ SYSTEM ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Agentic Pipeline offline. Error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)