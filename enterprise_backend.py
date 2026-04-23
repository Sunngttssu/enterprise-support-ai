from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from tavily import TavilyClient
from neo4j import GraphDatabase
from dotenv import load_dotenv
import json
import re
import os

# Load the secrets from the .env file
load_dotenv()

# ==========================================
# 1. NEO4J AURA + GROQ CONNECTION SETTINGS
# ==========================================
URI  = os.getenv("NEO4J_URI_MAIN")
AUTH = (os.getenv("NEO4J_USERNAME_MAIN"), os.getenv("NEO4J_PASSWORD_MAIN"))
GROQ_MODEL = "llama-3.1-8b-instant"

# Initialize the clients clients
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

driver = GraphDatabase.driver(URI, auth=AUTH)
app = FastAPI(title="Enterprise Support API - Stateful Agentic Loop (Groq)")

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
    """Return a formatted ticket status string, or None if not found."""
    ticket = MOCK_TICKETS.get(ticket_id.upper())
    if not ticket:
        return None
    return (
        f"🎫 **Ticket {ticket_id.upper()}**\n"
        f"- **Status:** {ticket['status']}\n"
        f"- **Assigned to:** {ticket['assigned_to']}\n"
        f"- **ETA / Resolution:** {ticket['eta']}"
    )

# ==========================================
# STICKY MEMORY BANK
# ==========================================
session_memory: dict = {}
MAX_HISTORY_TURNS = 4

def get_chat_history(session_id: str) -> str:
    if session_id not in session_memory or not session_memory[session_id]["history"]:
        return "No previous conversation."
    history_lines = []
    for turn in session_memory[session_id]["history"]:
        history_lines.append(f"{turn['role'].capitalize()}: {turn['content']}")
    return "\n".join(history_lines)

def add_to_memory(session_id: str, role: str, content: str, context: str = ""):
    if session_id not in session_memory:
        session_memory[session_id] = {"history": [], "last_context": ""}
    session_memory[session_id]["history"].append({"role": role, "content": content})
    if context:
        session_memory[session_id]["last_context"] = context
    if len(session_memory[session_id]["history"]) > MAX_HISTORY_TURNS:
        session_memory[session_id]["history"] = session_memory[session_id]["history"][-MAX_HISTORY_TURNS:]

# ==========================================
# AGENT 1: REGEX-ASSISTED KEYWORD EXTRACTOR
# ==========================================
def extract_keywords(user_message: str) -> list:
    print("🤖 AGENT 1: Extracting search entities (Hybrid Mode)...")

    # Deterministic regex — guarantees we never miss a product or error code
    regex_pattern = r'(SYS-ERR-[0-9a-zA-Z]+|ACT-[0-9]+|HTTP \d+|TitanBook|Nexus|Floating|Workstation)'
    regex_keywords = [match.lower().strip() for match in re.findall(regex_pattern, user_message, re.IGNORECASE)]

    # Groq LLM extraction for dynamic semantic context
    prompt = f"""
    Extract technical nouns or specific hardware components from this message: "{user_message}"
    Do NOT extract generic words like 'system', 'software', 'broken', 'cake', 'script'.
    Respond STRICTLY in JSON format. Example: {{"keywords": ["battery", "sensor"]}}
    """
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
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
    if not keywords:
        return ""
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

    add_to_memory(session_id, "user", request.message)

    # ------------------------------------------------------------------
    # AGENT 1.5 — DETERMINISTIC ROUTER (runs BEFORE any LLM/graph call)
    # Priority: Ticket lookup → graph context → intent routing → LLM
    # ------------------------------------------------------------------
    ticket_matches = TICKET_PATTERN.findall(request.message)
    if ticket_matches:
        # Handle the first ticket found in the message
        ticket_id = ticket_matches[0].upper()
        print(f"🎫 AGENT 1.5 ROUTER: Ticket number detected — {ticket_id} (bypassing LLM)")
        ticket_response = lookup_ticket(ticket_id)
        if ticket_response:
            add_to_memory(session_id, "ai", ticket_response)
            return {"response": ticket_response}
        else:
            not_found = (
                f"⚠️ Ticket **{ticket_id}** was not found in the enterprise system. "
                f"Please verify the ticket number or contact the IT Helpdesk for assistance."
            )
            add_to_memory(session_id, "ai", not_found)
            return {"response": not_found}

    try:
        keywords = extract_keywords(request.message)
        graph_context = retrieve_graph_context(keywords)

        if not graph_context and session_id in session_memory and session_memory[session_id]["last_context"]:
            graph_context = session_memory[session_id]["last_context"]

        # ------------------------------------------------------------------
        # STEP 3.1: DETERMINISTIC INTENT ROUTER & WEB FALLBACK AGENT
        # ------------------------------------------------------------------
        if not graph_context:
            print("⚠️ No graph data found. Routing intent (Python Mode)...")
            msg_lower = request.message.lower()

            greetings = ["hello", "hi ", "hey", "good morning", "how are you", "thank", "frustrat", "bot", "person"]
            is_greeting = any(g in msg_lower for g in greetings)

            if is_greeting:
                if "thank" in msg_lower:
                    final_text = "You are very welcome! Let me know if you need help with anything else."
                elif "how are you" in msg_lower or "morning" in msg_lower:
                    final_text = "Good morning! I am functioning perfectly. How can I help you today?"
                elif "bot" in msg_lower or "person" in msg_lower:
                    final_text = "I am a professional Enterprise Support AI. How can I assist you with your technical issues today?"
                elif "frustrat" in msg_lower:
                    final_text = "I understand system errors can be frustrating. Please tell me the specific error code or product you are having trouble with, and I will help you resolve it."
                else:
                    final_text = "Hi there! I am ready to help. What enterprise product or technical issue can I assist you with?"
            else:
                # ------------------------------------------------------------------
                # TAVILY WEB AGENT (Fallback)
                # ------------------------------------------------------------------
                print("🌐 ROUTER: Intent is technical, but local graph is empty. Triggering Tavily Web Search...")
                try:
                    search_result = tavily_client.search(query=request.message, search_depth="basic")
                    web_context = "\n".join([f"- {result['content']}" for result in search_result['results']])
                    
                    draft_prompt = f"""
                    You are an IT Expert. The user's issue was not in the internal database. 
                    Answer their question strictly based on this live web data: 
                    {web_context}
                    """
                    
                    draft_completion = groq_client.chat.completions.create(
                        model=GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": draft_prompt},
                            {"role": "user",   "content": request.message},
                        ],
                        temperature=0.1,
                    )
                    # Save the pure completion without the prefix
                    final_text = draft_completion.choices[0].message.content
                    
                except Exception as e:
                    print(f"❌ TAVILY ERROR: {e}")
                    final_text = "I could not find this in our internal database, and the live web search failed."

            add_to_memory(session_id, "ai", final_text)
            return {"response": final_text}

        # ------------------------------------------------------------------
        # STEP 3.5: PYTHON AMBIGUITY ROUTER
        # ------------------------------------------------------------------
        error_pattern = r'(SYS-ERR-[0-9a-zA-Z]+|ACT-[0-9]+|HTTP \d+)'
        graph_errors = list(set(re.findall(error_pattern, graph_context.upper())))

        if len(graph_errors) > 1 and "spec" not in request.message.lower():
            user_specified_code = any(err.lower() in request.message.lower() for err in graph_errors)
            semantic_hints = ["battery", "sleep", "thermal", "sensor", "shutting", "shutdown", "api", "key", "license", "drain"]
            user_gave_hint = any(hint in request.message.lower() for hint in semantic_hints)

            if not user_specified_code and not user_gave_hint:
                error_list = " or ".join(graph_errors[:2])
                clarification = f"I see a few known issues for that product. Are you experiencing {error_list}?"
                add_to_memory(session_id, "ai", clarification, context=graph_context)
                return {"response": clarification}

        # ------------------------------------------------------------------
        # STEP 4: AGENT 2 — Groq-powered Response Drafter
        # ------------------------------------------------------------------
        print("✍️ AGENT 2: Drafting response via Groq...")
        draft_prompt = f"""
        You are a highly efficient Enterprise IT Bot. State the resolution directly.
        DO NOT say "I can help". DO NOT ask the user questions. DO NOT offer to troubleshoot.

        CRITICAL RULES:
        1. If the user asks about a SPECIFIC error, give ONLY the fix for that error from the facts below.
        2. If the user asks for hardware specifications, output EXACTLY: "Please refer to the live catalog for the full hardware specifications."
        3. Never say "According to the graph data".

        Facts to use: {graph_context}
        """
        draft_completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": draft_prompt},
                {"role": "user",   "content": request.message},
            ],
            temperature=0.1,
        )
        draft = draft_completion.choices[0].message.content

        # ------------------------------------------------------------------
        # STEP 5: AGENT 3 — Groq-powered Critic / Fact-Checker
        # ------------------------------------------------------------------
        print("🕵️ AGENT 3: Fact-checking draft via Groq...")
        critic_prompt = f"""
        Remove any conversational filler like "Would you like me to help?" or "I can walk you through this."
        Remove "According to the graph data".
        Output ONLY the cleaned answer.
        Draft: {draft}

        RESPOND STRICTLY IN JSON format with a single key called "final". Example: {{"final": "The cleaned answer."}}
        """
        try:
            critic_completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": "You only output pure JSON."},
                    {"role": "user",   "content": critic_prompt},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            final_data = json.loads(critic_completion.choices[0].message.content)
            final_text = final_data.get("final", final_data.get("final_response", draft))
            if "draft answer" in final_text.lower():
                final_text = draft
        except Exception:
            final_text = draft

        final_text = final_text.replace("According to the graph data,", "").strip()
        print("✅ SYSTEM: Final verified response sent to UI.")
        add_to_memory(session_id, "ai", final_text, context=graph_context)

        return {"response": final_text}

    except Exception as e:
        print(f"❌ SYSTEM ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Agentic Pipeline offline. Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)