import os
import json
from langchain_neo4j import Neo4jGraph

# --- 1. CONNECT TO YOUR CLOUD DATABASE ---
os.environ["NEO4J_URI"] = "neo4j+s://<your-aura-instance-id>.databases.neo4j.io"
os.environ["NEO4J_USERNAME"] = "<your-username>"
os.environ["NEO4J_PASSWORD"] = "<your-password>"

try:
    graph = Neo4jGraph()
    print("🔌 Connected to Neo4j AuraDB!")
except Exception as e:
    print(f"❌ Connection Failed: {e}")
    exit()

DATA_FILE = "processed_data/live_catalog_data.json"

def expand_knowledge_graph():
    if not os.path.exists(DATA_FILE):
        print(f"❌ Cannot find {DATA_FILE}. Run catalog_api_fetcher.py first!")
        return

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        catalog_data = json.load(f)

    print(f"🚀 Pushing {len(catalog_data)} live commercial products into the Knowledge Graph...")

    # --- THE CYPHER QUERY (Fuzzy Matching) ---
    # We use toLower() and CONTAINS to map "iPhone 13" to "Apple - iPhone 13 5G 128GB"
    cypher_query = """
    // Match any existing device in the graph where the name partially matches our search target
    MATCH (d:Device)
    WHERE toLower(d.name) CONTAINS toLower($search_target)
    
    // Create the commercial entities
    MERGE (c:Category {name: $category})
    MERGE (d)-[:BELONGS_TO_CATEGORY]->(c)
    
    MERGE (s:SKU {id: $sku})
    SET s.retail_name = $api_name, s.price = $price, s.source = $source
    MERGE (d)-[:HAS_COMMERCIAL_SKU]->(s)
    
    // Add the specific specifications
    FOREACH (spec IN $specs | 
        MERGE (f:Specification {name: spec}) 
        MERGE (s)-[:HAS_SPECIFICATION]->(f)
    )
    """

    for item in catalog_data:
        print(f"  -> Linking API Data ({item['source']}) to Graph Node: {item['search_target']}")
        
        graph.query(
            cypher_query,
            params={
                "search_target": item["search_target"],
                "api_name": item["api_name"],
                "sku": item["sku"],
                "category": item["category"],
                "price": item["price"],
                "specs": item["specs"],
                "source": item["source"]
            }
        )
        
    print("\n✅ Knowledge Graph successfully expanded with LIVE API data!")

if __name__ == "__main__":
    expand_knowledge_graph()