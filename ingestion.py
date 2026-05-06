import os
import json
import re
import time
from pypdf import PdfReader
from neo4j import GraphDatabase
from openai import OpenAI
from dotenv import load_dotenv

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
    """Passes raw manual text to Meta Llama 3.3 to extract Graph Nodes and Relationships."""
    
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
            model="meta/llama-3.3-70b-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        
        raw_output = response.choices[0].message.content
        # Clean markdown formatting if the model includes it
        clean_json = raw_output.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        return data.get("relationships", [])
    except Exception as e:
        print(f"⚠️ Extraction Failed for this chunk: {e}")
        return []

def push_to_neo4j(relationships: list):
    """Writes the extracted JSON data into the Neo4j Knowledge Graph."""
    if not relationships:
        print("⚠️ No valid relationships found to push.")
        return
        
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
    """Scans the manual folder and processes new files in safe chunks."""
    print("🔄 Starting Scheduled Knowledge Ingestion...")
    folder_path = "enterprise_manuals"
    
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        print("Folder created. No manuals to process.")
        return

    for filename in os.listdir(folder_path):
        if filename.endswith(".pdf"):
            filepath = os.path.join(folder_path, filename)
            print(f"\n📄 Processing Document: {filename}")
            
            # 1. Read PDF (Up to 20 pages max to save free credits)
            reader = PdfReader(filepath)
            max_pages = min(len(reader.pages), 20)
            
            full_text = ""
            for i in range(max_pages):
                page_text = reader.pages[i].extract_text()
                if page_text:
                    full_text += page_text + "\n"
            
            # 2. Chunk the text into safe 4000-character blocks
            chunk_size = 4000
            chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
            
            print(f"🧩 Split {max_pages} pages into {len(chunks)} chunks. Extracting facts...")
            
            all_relationships = []
            
            # 3. Process each chunk sequentially with a rate-limit delay
            for idx, chunk in enumerate(chunks):
                print(f"   -> Analyzing chunk {idx + 1} of {len(chunks)}...")
                rels = extract_knowledge_from_text(chunk)
                
                if rels:
                    all_relationships.extend(rels)
                
                # THROTTLING: Wait 4 seconds between chunks to protect your free API tier
                if idx < len(chunks) - 1:
                    time.sleep(4) 
            
            # 4. Push all aggregated facts to Graph Database
            print("🚀 Pushing all extracted facts to Neo4j...")
            push_to_neo4j(all_relationships)
            
            # 5. Rename file so it isn't processed again tomorrow
            os.rename(filepath, filepath + ".processed")
            print(f"✅ Finished {filename}. Marked as processed.")
            
    print("\n✅ Ingestion Cycle Complete.")

# If you ever want to run this file directly to test it without starting the server, 
# uncomment the two lines below:
# if __name__ == "__main__":
#     run_daily_ingestion()