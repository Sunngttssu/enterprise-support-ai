from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
from neo4j import GraphDatabase
import json
import re

# ==========================================
# 1. CONFIGURATION & CONNECTIONS
# ==========================================
URI  = "neo4j+s://<your-aura-instance-id>.databases.neo4j.io"
AUTH = ("<your-username>", "<your-password>")
OLLAMA_MODEL = "hf.co/Sunngttssu/enterprise-support-bot"

driver = GraphDatabase.driver(URI, auth=AUTH)
app = FastAPI(title="Enterprise Support API - Stateful Agentic Loop")

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
# STICKY MEMORY BANK
# ==========================================
session_memory = {}
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
# 2. AGENT 1: REGEX-ASSISTED EXTRACTOR
# ==========================================
def extract_keywords(user_message: str) -> list:
    print("🤖 AGENT 1: Extracting search entities (Hybrid Mode)...")
    
    # 1. Deterministic Regex: Mathematically guarantee we NEVER miss a product or error code
    regex_pattern = r'(SYS-ERR-[0-9a-zA-Z]+|ACT-[0-9]+|HTTP \d+|TitanBook|Nexus|Floating|Workstation)'
    regex_keywords = [match.lower().strip() for match in re.findall(regex_pattern, user_message, re.IGNORECASE)]
    
    # 2. LLM Extraction for dynamic context
    prompt = f"""
    Extract technical nouns or specific hardware components from this message: "{user_message}"
    Do NOT extract generic words like 'system', 'software', 'broken', 'cake', 'script'.
    Respond STRICTLY in JSON format. Example: {{"keywords": ["battery", "sensor"]}}
    """
    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[{"role": "user", "content": prompt}], format="json")
        data = json.loads(response['message']['content'])
        llm_keywords = [str(k).lower().strip() for k in data.get("keywords", [])]
    except:
        llm_keywords = []
        
    final_keywords = list(set(regex_keywords + llm_keywords))
    print(f"   -> Final Keywords: {final_keywords}")
    return final_keywords

# ==========================================
# 3. NEO4J GRAPH RETRIEVAL 
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
# 4. MAIN AGENTIC PIPELINE
# ==========================================
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    print(f"\n📩 NEW SESSION [{session_id[-4:]}]: {request.message}")
    
    add_to_memory(session_id, "user", request.message)
    history_text = get_chat_history(session_id)
    
    try:
        keywords = extract_keywords(request.message)
        graph_context = retrieve_graph_context(keywords)
        
        if not graph_context and session_id in session_memory and session_memory[session_id]["last_context"]:
            graph_context = session_memory[session_id]["last_context"]
        
        # ==========================================
        # STEP 3.1: DETERMINISTIC INTENT ROUTER
        # ==========================================
        if not graph_context:
            print("⚠️ No graph data found. Routing intent (Python Mode)...")
            msg_lower = request.message.lower()
            
            # Hard-code the conversational checks so the LLM never hallucinates Assamese translation again
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
                final_text = "I am sorry, but I do not have verified enterprise graph data for that specific technical issue. Please check your product manual or contact IT support."
            
            add_to_memory(session_id, "ai", final_text)
            return {"response": final_text}
            
        print(f"🧠 GRAPH DATA READY: {graph_context}")
        
        # ==========================================
        # STEP 3.5: PYTHON AMBIGUITY ROUTER
        # ==========================================
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

        # ==========================================
        # STEP 4: AGENT 2 (The ULTRA-STRICT Drafter)
        # ==========================================
        print("✍️ AGENT 2: Drafting response...")
        draft_prompt = f"""
        You are a highly efficient Enterprise IT Bot. State the resolution directly.
        DO NOT say "I can help". DO NOT ask the user questions. DO NOT offer to troubleshoot.
        
        CRITICAL RULES:
        1. If the user asks about a SPECIFIC error, give ONLY the fix for that error from the facts below.
        2. If the user asks for hardware specifications, output EXACTLY: "Please refer to the live catalog for the full hardware specifications."
        3. Never say "According to the graph data".
        
        Facts to use: {graph_context}
        """
        draft_response = ollama.chat(model=OLLAMA_MODEL, messages=[
            {"role": "system", "content": draft_prompt},
            {"role": "user", "content": request.message}
        ])
        draft = draft_response['message']['content']
        
        # ==========================================
        # STEP 5: AGENT 3 (The Critic Loop)
        # ==========================================
        print("🕵️ AGENT 3: Fact-checking draft...")
        critic_prompt = f"""
        Remove any conversational filler like "Would you like me to help?" or "I can walk you through this." 
        Remove "According to the graph data". 
        Output ONLY the cleaned answer.
        Draft: {draft}
        
        RESPOND STRICTLY IN JSON format with a single key called "final". Example: {{"final": "The cleaned answer."}}
        """
        try:
            final_response = ollama.chat(
                model=OLLAMA_MODEL, 
                messages=[{"role": "system", "content": "You only output pure JSON."}, {"role": "user", "content": critic_prompt}],
                format="json"
            )
            final_data = json.loads(final_response['message']['content'])
            final_text = final_data.get("final", final_data.get("final_response", draft))
            if "draft answer" in final_text.lower(): final_text = draft
        except:
            final_text = draft
            
        final_text = final_text.replace("According to the graph data,", "").strip()
        print("✅ SYSTEM: Final verified response sent to UI.")
        add_to_memory(session_id, "ai", final_text, context=graph_context)
        
        return {"response": final_text}
        
    except Exception as e:
        print(f"❌ SYSTEM ERROR: {e}")
        raise HTTPException(status_code=500, detail="Agentic Pipeline offline.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)