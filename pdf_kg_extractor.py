import os
import json
from unstructured.partition.pdf import partition_pdf
from unstructured.cleaners.core import clean_bullets, clean_extra_whitespace

RAW_DATA_DIR = "raw_data"
PROCESSED_DIR = "processed_data"

def process_enterprise_manuals():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    graph_chunks = []

    print("🚀 Initializing Data Pipeline for Hybrid Retrieval...")
    print(f"📂 Scanning directory: {RAW_DATA_DIR} for technical documents\n")

    # Walk through the raw_data directory to locate all company folders and PDFs
    for root, dirs, files in os.walk(RAW_DATA_DIR):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_path = os.path.join(root, file)
                company_name = os.path.basename(root) 
                
                print(f"📄 Processing: {file} (Enterprise: {company_name})")
                
                try:
                    # 'fast' strategy ensures rapid local execution, bypassing 
                    # heavy visual layout models for clean, efficient text extraction.
                    elements = partition_pdf(
                        filename=pdf_path,
                        strategy="fast"
                    )
                    
                    current_title = "General Context"
                    
                    for element in elements:
                        # Clean the extracted text to remove PDF artifacts
                        text = clean_bullets(element.text)
                        text = clean_extra_whitespace(text)
                        
                        # Skip empty elements or extremely short artifacts
                        if not text or len(text) < 15:
                            continue 
                            
                        # Track the Document Title or Header to maintain context
                        if element.category in ["Title", "Header"]:
                            current_title = text
                            continue
                            
                        # Build the Knowledge Chunk for the Vector DB and Graph mapping
                        chunk = {
                            "Node_Type": "ManualSection",
                            "Company": company_name,
                            "Source_File": file,
                            "Section_Title": current_title, 
                            "Content": text,
                            "Page_Number": element.metadata.page_number if hasattr(element.metadata, 'page_number') else "Unknown"
                        }
                        graph_chunks.append(chunk)
                        
                except Exception as e:
                    print(f"  ❌ Error processing {file}. It may be corrupted. Error: {e}")

    if not graph_chunks:
        print("\n⚠️ No text chunks were extracted. Ensure PDFs contain readable text.")
        return

    # Save the processed data to a clean JSON file
    output_file = os.path.join(PROCESSED_DIR, "fcc_manual_chunks.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(graph_chunks, f, indent=4)
        
    print(f"\n✅ Data Engineering Complete! Processed {len(graph_chunks)} text chunks and saved to {output_file}")

if __name__ == "__main__":
    process_enterprise_manuals()