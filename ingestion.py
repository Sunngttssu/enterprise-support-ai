import os
import json
import re
from pypdf import PdfReader
from neo4j import GraphDatabase
from openai import OpenAI
from dotenv import load_dotenv # <-- Add this import

# Load environment variables FIRST before trying to read them
load_dotenv() 

# Initialize connections using existing environment variables
URI  = os.getenv("NEO4J_URI_MAIN")
AUTH = (os.getenv("NEO4J_USERNAME_MAIN"), os.getenv("NEO4J_PASSWORD_MAIN"))
driver = GraphDatabase.driver(URI, auth=AUTH)

# Use NVIDIA NIM for extraction
nvidia_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

def extract_knowledge_from_text(text_chunk: str) -> list:
    """Passes raw manual text to Grok to extract Graph Nodes and Relationships."""
    
    prompt = f"""
    You are an enterprise data extraction algorithm. 
    Analyze the following IT manual text and extract technical relationships.
    
    RULES:
    1. Output strictly in JSON format.
    2. Format: {{"relationships": [{{"source": "Device/Software", "relation": "VERB", "target": "Error/Fix"}}]}}
    3. The 'relation' MUST be a single uppercase word (e.g., HAS_ERROR, FIXED_BY, REQUIRES).
    
    TEXT:
    {text_chunk}
    """
    
    try:
        response = nvidia_client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct", # <-- The newest Meta model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        
        raw_output = response.choices[0].message.content
        # Clean markdown formatting if Grok includes it
        clean_json = raw_output.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        return data.get("relationships", [])
    except Exception as e:
        print(f"⚠️ Extraction Failed: {e}")
        return []

def push_to_neo4j(relationships: list):
    """Writes the extracted JSON data into the Neo4j Knowledge Graph."""
    if not relationships:
        return
        
    cypher = """
    UNWIND $rels AS rel
    // Ensure nodes exist
    MERGE (s:Entity {name: toLower(rel.source)})
    MERGE (t:Entity {name: toLower(rel.target)})
    // Create the dynamic relationship
    WITH s, t, rel
    CALL apoc.merge.relationship(s, toUpper(rel.relation), {}, {}, t) YIELD rel AS r
    RETURN count(r)
    """
    
    # Fallback Cypher if APOC is not installed on your free tier
    fallback_cypher = """
    UNWIND $rels AS rel
    MERGE (s:Entity {name: toLower(rel.source)})
    MERGE (t:Entity {name: toLower(rel.target)})
    MERGE (s)-[:RELATES_TO {type: toUpper(rel.relation)}]->(t)
    """
    
    try:
        with driver.session() as session:
            session.run(fallback_cypher, rels=relationships)
            print(f"✅ Successfully ingested {len(relationships)} facts into Neo4j.")
    except Exception as e:
        print(f"⚠️ Neo4j Write Error: {e}")

def run_daily_ingestion():
    """Scans the manual folder and processes new files."""
    print("🔄 Starting Scheduled Knowledge Ingestion...")
    folder_path = "enterprise_manuals"
    
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        print("Folder created. No manuals to process.")
        return

    for filename in os.listdir(folder_path):
        if filename.endswith(".pdf"):
            filepath = os.path.join(folder_path, filename)
            print(f"📄 Processing: {filename}")
            
            # 1. Read PDF
            reader = PdfReader(filepath)
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() + "\n"
            
            # 2. Extract Data
            # Note: For massive PDFs, you would chunk this. We assume short IT bulletins for now.
            relationships = extract_knowledge_from_text(full_text[:4000]) 
            
            # 3. Push to Graph
            push_to_neo4j(relationships)
            
            # 4. Rename file so it isn't processed again tomorrow
            os.rename(filepath, filepath + ".processed")
            
    print("✅ Ingestion Cycle Complete.")