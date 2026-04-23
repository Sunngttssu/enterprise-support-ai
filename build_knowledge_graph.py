import os
import ollama
from dotenv import load_dotenv
from neo4j import GraphDatabase

# Load the secrets from the .env file
load_dotenv()

# ==========================================
# 1. NEO4J AURA CONNECTION SETTINGS
# ==========================================
URI  = os.getenv("NEO4J_URI_MAIN")
AUTH = (os.getenv("NEO4J_USERNAME_MAIN"), os.getenv("NEO4J_PASSWORD_MAIN"))
OLLAMA_MODEL = "hf.co/Sunngttssu/enterprise-support-bot"

# Initialize the Neo4j Driver
driver = GraphDatabase.driver(URI, auth=AUTH)

# ==========================================
# 2. THE EXTRACTION PROMPT
# ==========================================
# This strict prompt forces your local model to act as a Data Engineer
EXTRACTION_PROMPT = """
You are an expert enterprise data extractor. Read the following technical support text.
Extract the relationships in EXACTLY this format, one per line:
(Product Name)-[HAS_ERROR]->(Error Code)
(Error Code)-[CAUSED_BY]->(Cause)
(Error Code)-[RESOLVED_BY]->(Resolution Step)

Do not add any conversational text. Only output the relationships.

Text to analyze:
{text}
"""

# ==========================================
# 3. GRAPH INGESTION LOGIC
# ==========================================
def run_cypher(query):
    """Executes a Cypher query on the Neo4j Aura database."""
    with driver.session() as session:
        session.run(query)

def process_and_ingest(folder_path):
    print(f"📂 Scanning directory: {folder_path}...")
    
    for filename in os.listdir(folder_path):
        if filename.endswith(".txt"):
            file_path = os.path.join(folder_path, filename)
            print(f"\n📄 Processing: {filename}")
            
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Ask local Ollama to extract the Graph Triples
            print("🧠 Asking local Llama-3 to extract graph entities...")
            response = ollama.chat(model=OLLAMA_MODEL, messages=[
                {"role": "system", "content": "You output strict graph relationships."},
                {"role": "user", "content": EXTRACTION_PROMPT.format(text=content)}
            ])
            
            extracted_data = response['message']['content']
            
            # Simple parser to push the LLM's output into Neo4j
            print("⚡ Pushing data to Neo4j Aura...")
            for line in extracted_data.split('\n'):
                if '-[' in line and ']->' in line:
                    try:
                        # Clean and parse the string like (A)-[REL]->(B)
                        parts = line.split('-[')
                        node_a = parts[0].strip('() ')
                        rel_and_b = parts[1].split(']->')
                        relationship = rel_and_b[0].strip()
                        node_b = rel_and_b[1].strip('() ')
                        
                        # Build the Cypher query
                        cypher_query = f"""
                        MERGE (a:Entity {{name: "{node_a}"}})
                        MERGE (b:Entity {{name: "{node_b}"}})
                        MERGE (a)-[:{relationship}]->(b)
                        """
                        run_cypher(cypher_query)
                    except Exception as e:
                        # Skip malformed lines from the LLM
                        continue
                        
            print("✅ Document successfully mapped into Knowledge Graph!")

# ==========================================
# 4. EXECUTE PIPELINE
# ==========================================
if __name__ == "__main__":
    # Point this to the folder where you saved the 3 text files
    data_folder = r"E:\Majot_Project_Phase_II\knowledge_base"
    # Create folder if it doesn't exist to prevent crashes
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)
        print(f"Created folder '{data_folder}'. Please put your .txt files inside it and run again.")
    else:
        # Clear the database before running (Great for testing!)
        print("🧹 Clearing old graph data...")
        run_cypher("MATCH (n) DETACH DELETE n")
        
        # Start the ingestion
        process_and_ingest(data_folder)
        
    driver.close()
    print("\n🎉 GRAPH PIPELINE COMPLETE!")