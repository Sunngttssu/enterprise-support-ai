import os
import json
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

DB_DIR = "chroma_db"
DATA_FILE = "E:\Majot_Project_Phase_II\processed_data\fcc_manual_chunks.json"

def ingest_to_vector_db():
    print("🚀 Initializing Local Embedding Model (all-MiniLM-L6-v2)...")
    # This is a fast, highly-efficient open-source embedding model
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    print(f"📂 Loading unstructured text chunks from {DATA_FILE}...")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        raw_chunks = json.load(f)
        
    print(f"Total chunks to process: {len(raw_chunks)}")
    
    # Convert JSON dictionaries into LangChain Document objects
    documents = []
    for chunk in raw_chunks:
        doc = Document(
            page_content=chunk["Content"],
            metadata={
                "Company": chunk["Company"],
                "Source_File": chunk["Source_File"],
                "Section_Title": chunk["Section_Title"],
                "Page_Number": str(chunk.get("Page_Number", "Unknown"))
            }
        )
        documents.append(doc)

    print("💾 Creating ChromaDB and embedding documents. This may take a few minutes...")
    
    # Chroma handles batching automatically under the hood, but we process in chunks to be safe
    # We will initialize the DB, then add documents in batches of 5000
    vectorstore = Chroma(embedding_function=embeddings, persist_directory=DB_DIR)
    
    batch_size = 5000
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        print(f"  -> Embedding and storing batch {i} to {i + len(batch)}...")
        vectorstore.add_documents(batch)
        
    print(f"\n✅ Vector Database successfully built at ./{DB_DIR}!")
    print("Your AI can now perform semantic searches across all enterprise manuals.")

if __name__ == "__main__":
    ingest_to_vector_db()