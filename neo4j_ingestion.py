import os
import json
from langchain_neo4j import Neo4jGraph

# --- 1. CONNECT TO YOUR CLOUD DATABASE ---
# Replace these strings with the exact credentials from your Neo4j .txt file!
NEO4J_URI = "neo4j+s://20c17098.databases.neo4j.io"
NEO4J_USERNAME = "neo4j"
NEO4J_PASSWORD = "ocyc7UlFs170Mlnha_Jnoc5KD2-srS2xe5TarmQMrio"

print("🔌 Connecting to Neo4j AuraDB...")
try:
    graph = Neo4jGraph(
        url=NEO4J_URI, 
        username=NEO4J_USERNAME, 
        password=NEO4J_PASSWORD
    )
    print("✅ Connection Successful!")
except Exception as e:
    print(f"❌ Connection Failed. Check your credentials! Error: {e}")
    exit()

def ingest_to_neo4j():
    # --- 2. LOAD THE STRUCTURED IFIXIT DATA ---
    file_path = "processed_data/ifixit_graph_nodes.json"
    if not os.path.exists(file_path):
        print(f"❌ Could not find {file_path}. Did you run ifixit_kg_extractor.py?")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        guides = json.load(f)

    print(f"🚀 Pushing {len(guides)} guides into the Knowledge Graph...")

    # --- 3. THE CYPHER QUERY (Graph Logic) ---
    # This translates your JSON into physical Graph Nodes and Edges
    cypher_query = """
    MERGE (d:Device {name: $device})
    MERGE (g:Guide {title: $title})
    SET g.difficulty = $difficulty
    MERGE (d)-[:HAS_GUIDE]->(g)
    
    FOREACH (tool_name IN $tools | 
        MERGE (t:Tool {name: tool_name}) 
        MERGE (g)-[:REQUIRES_TOOL]->(t)
    )
    
    FOREACH (part_name IN $parts | 
        MERGE (p:Part {name: part_name}) 
        MERGE (g)-[:USES_PART]->(p)
    )
    """

    # --- 4. EXECUTE THE PUSH ---
    for guide in guides:
        print(f"  -> Ingesting Node: {guide['Guide_Title']}")
        
        graph.query(
            cypher_query,
            params={
                "device": guide["Device"],
                "title": guide["Guide_Title"],
                "difficulty": guide["Difficulty"],
                "tools": guide["Relationships"]["REQUIRES_TOOL"],
                "parts": guide["Relationships"]["USES_PART"]
            }
        )
        
    print("\n✅ Knowledge Graph successfully populated! Your AI now has 'reasoning' architecture.")

if __name__ == "__main__":
    ingest_to_neo4j()