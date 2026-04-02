import requests
import json
import os

# Enterprise devices relevant to your support chatbot
TARGET_DEVICES = [
    "iPhone 12", "iPhone 13", "iPhone 14", 
    "Samsung Galaxy S22", "Samsung Galaxy S23",
    "Lenovo ThinkPad", "MacBook Pro", "Sony PlayStation 5"
]
BASE_URL = "https://www.ifixit.com/api/2.0"

def search_device_guides(query):
    """Searches iFixit for guides related to a specific device."""
    print(f"🔍 Searching iFixit for: {query}")
    url = f"{BASE_URL}/search/{query}?filter=guide&limit=5"
    response = requests.get(url)
    
    if response.status_code == 200:
        results = response.json().get('results', [])
        valid_ids = []
        for item in results:
            # The search API uses 'id' for the guide identifier
            g_id = item.get('id') or item.get('guideid')
            if g_id:
                valid_ids.append(g_id)
            else:
                print(f"  -> Warning: Could not find ID. Available keys are: {list(item.keys())}")
        return valid_ids
    else:
        print(f"  -> API Error: {response.status_code}")
        return []

def extract_guide_knowledge(guide_id):
    """Extracts step-by-step logic, tools, and parts for Graph nodes."""
    url = f"{BASE_URL}/guides/{guide_id}"
    response = requests.get(url)
    
    if response.status_code != 200:
        return None
        
    data = response.json()
    
    # Building the Graph Schema Dictionary
    kg_entity = {
        "Node_Type": "RepairGuide",
        "Guide_Title": data.get("title"),
        "Device": data.get("subject"),
        "Difficulty": data.get("difficulty"),
        "Relationships": {
            "REQUIRES_TOOL": [tool['text'] for tool in data.get("tools", [])],
            "USES_PART": [part['text'] for part in data.get("parts", [])],
            "HAS_STEP": []
        }
    }
    
    # Extract raw wiki text for the steps
    for step in data.get("steps", []):
        for line in step.get("lines", []):
            if line.get("text_raw"):
                kg_entity["Relationships"]["HAS_STEP"].append(line["text_raw"])
                
    return kg_entity

def run_ifixit_pipeline():
    os.makedirs("processed_data", exist_ok=True)
    all_knowledge = []
    
    for device in TARGET_DEVICES:
        guide_ids = search_device_guides(device)
        for g_id in guide_ids:
            print(f"  -> Extracting Guide ID: {g_id}")
            knowledge = extract_guide_knowledge(g_id)
            if knowledge:
                all_knowledge.append(knowledge)
                
    # Save the structured data for Neo4j ingestion
    output_file = "processed_data/ifixit_graph_nodes.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_knowledge, f, indent=4)
    print(f"\n✅ Successfully saved {len(all_knowledge)} guides to {output_file}")

if __name__ == "__main__":
    run_ifixit_pipeline()