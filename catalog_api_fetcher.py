import os
import json
import requests
import time

PROCESSED_DIR = "processed_data"
OUTPUT_FILE = os.path.join(PROCESSED_DIR, "live_catalog_data.json")

# A master list of the exact devices found in your PDFs, using their real-world UPCs and MPNs
DEVICE_CATALOG = [
    # --- APPLE ECOSYSTEM ---
    {"target": "iPhone 13", "upc": "194252707221", "brand": "Apple", "mpn": "MLPF3LL/A"},
    {"target": "iPhone 14 Pro Max", "upc": "194253380638", "brand": "Apple", "mpn": "MQ8X3LL/A"},
    {"target": "MacBook Pro 16-inch", "upc": "190199313247", "brand": "Apple", "mpn": "MVVJ2LL/A"},
    {"target": "Apple iPad 9th Gen", "upc": "194252515666", "brand": "Apple", "mpn": "MK2K3LL/A"},
    {"target": "Apple Watch Series 7", "upc": "194252585256", "brand": "Apple", "mpn": "MKN53LL/A"},

    # --- CISCO ENTERPRISE NETWORKING ---
    {"target": "Cisco IP Conference Phone 8832", "upc": "882658865039", "brand": "Cisco", "mpn": "CP-8832-K9="},
    {"target": "Cisco Aironet 1540 Access Point", "upc": "889728005378", "brand": "Cisco", "mpn": "AIR-AP1542I-B-K9"},
    {"target": "Cisco Catalyst 9164 Wi-Fi 6E", "upc": "889728362617", "brand": "Cisco", "mpn": "CW9164I-B"},
    {"target": "Cisco Webex Board 55", "upc": "889728040621", "brand": "Cisco", "mpn": "CS-BOARD55-K9"},
    {"target": "Cisco Catalyst IW9165E Rugged", "upc": "889728394465", "brand": "Cisco", "mpn": "IW9165E-B"},
    {"target": "Cisco Headset USB-C Adapter", "upc": "889728203002", "brand": "Cisco", "mpn": "HS-WL-ADPT-USBC"},

    # --- SAMSUNG MOBILE, IoT, & APPLIANCES ---
    {"target": "Samsung Galaxy S22", "upc": "887276625828", "brand": "Samsung", "mpn": "SM-S901UZKAXAA"},
    {"target": "Samsung Galaxy S25 (SM-S931U)", "upc": "887276813201", "brand": "Samsung", "mpn": "SM-S931UZKAXAA"}, 
    {"target": "Samsung Galaxy SmartTag2", "upc": "887276785126", "brand": "Samsung", "mpn": "EI-T5600BBEGUS"},
    {"target": "Samsung SmartThings Station Charger", "upc": "887276711712", "brand": "Samsung", "mpn": "EP-P9500TBEGUS"},
    {"target": "Samsung Galaxy Book3 Pro", "upc": "887276735527", "brand": "Samsung", "mpn": "NP935QNA-KB1US"},
    {"target": "Samsung Over-the-Range Microwave", "upc": "887276816486", "brand": "Samsung", "mpn": "ME21DG6500SR"},

    # --- SONY GAMING & AUDIO ---
    {"target": "Sony DualShock 4 Controller", "upc": "711719504335", "brand": "Sony", "mpn": "CUH-ZCT2U"},
    {"target": "Sony PlayStation Vita", "upc": "711719990152", "brand": "Sony", "mpn": "PCH-1001"},
    {"target": "Sony UWP-D11 Wireless Mic", "upc": "027242878774", "brand": "Sony", "mpn": "UWP-D11/14"},
    {"target": "Sony Wireless Noise Canceling Headset", "upc": "027242307137", "brand": "Sony", "mpn": "WH1000XM5/B"},
    {"target": "Sony Soundbar", "upc": "027242318621", "brand": "Sony", "mpn": "HT-S2000"},

    # --- TESLA AUTOMOTIVE ACCESSORIES ---
    # Note: Tesla B2B modules do not use retail UPCs. We use standard identifiers so Icecat can map the MPN.
    {"target": "Tesla Wireless Phone Charger (WC6)", "upc": "000000000000", "brand": "Tesla", "mpn": "1622353-00-A"},
    {"target": "Tesla Model 3/Y Key Fob", "upc": "000000000000", "brand": "Tesla", "mpn": "1541334-00-A"},
    {"target": "Tesla QCA6234 Wi-Fi Module", "upc": "000000000000", "brand": "Tesla", "mpn": "QCA6234"}
]
def fetch_enriched_catalog_data():
    print("🚀 Initiating Keyless Data Enrichment Pipeline...")
    results = []

    for device in DEVICE_CATALOG:
        target = device["target"]
        print(f"\n  -> Fetching live data for: {target}")
        
        # 1. Fetch Pricing and Category from UPCitemDB
        # No API key required for trial endpoint (<100 requests/day)
        upc_url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={device['upc']}"
        
        retail_name = target
        category = "Enterprise Tech"
        price = "Out of Stock"
        
        try:
            upc_response = requests.get(upc_url)
            upc_data = upc_response.json()
            
            if upc_data.get("code") == "OK" and upc_data.get("items"):
                item = upc_data["items"][0]
                retail_name = item.get("title", target)
                category = item.get("category", category).split(" > ")[-1] # Get the most specific category
                
                # Grab the lowest available live price
                if item.get("lowest_recorded_price"):
                    price = f"${item['lowest_recorded_price']}"
                    
            print(f"     ✅ Found Pricing: {price} (via UPCitemDB)")
        except Exception as e:
            print(f"     ❌ UPCitemDB Error: {e}")

        # 2. Fetch Deep Technical Specs from Icecat
        icecat_url = f"https://live.icecat.biz/api/?shopname=openicecat-live&lang=en&Brand={device['brand']}&ProductCode={device['mpn']}"
        specs = []
        
        try:
            icecat_response = requests.get(icecat_url)
            icecat_data = icecat_response.json()
            
            if icecat_data.get("msg") == "OK" and icecat_data.get("data"):
                features = icecat_data["data"].get("FeaturesGroups", [])
                if features:
                    # Extract the top 4 technical specifications
                    for feature in features[0].get("Features", [])[:4]:
                        name = feature.get("Feature", {}).get("Name", {}).get("Value")
                        val = feature.get("Value")
                        if name and val:
                            specs.append(f"{name}: {val}")
                            
            print(f"     ✅ Found {len(specs)} Technical Specs (via Icecat)")
        except Exception as e:
            print(f"     ❌ Icecat Error: {e}")

        # 3. Compile the Enriched Node
        results.append({
            "search_target": target,
            "api_name": retail_name,
            "sku": device["upc"],
            "category": category,
            "price": price,
            "specs": specs,
            "source": "UPCitemDB + Icecat"
        })
        
        # Be polite to open APIs to avoid IP bans
        time.sleep(2)

    return results

if __name__ == "__main__":
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    
    enriched_data = fetch_enriched_catalog_data()
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(enriched_data, f, indent=4)
        
    print(f"\n🎉 Successfully compiled {len(enriched_data)} enriched products!")
    print(f"Data saved to {OUTPUT_FILE}. You are ready to update Neo4j.")