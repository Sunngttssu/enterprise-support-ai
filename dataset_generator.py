import os
import json
import random
from langchain_community.chat_models import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
# --- CONFIGURATION ---
# Using raw strings (r"") to prevent Windows file path errors
INPUT_FILE = r"E:\Majot_Project_Phase_II\processed_data\fcc_manual_chunks.json"
OUTPUT_FILE = r"E:\Majot_Project_Phase_II\processed_data\synthetic_finetuning_data.jsonl"
# Initialize local Ollama instance
llm = ChatOllama(
    base_url="http://localhost:11434",
    model="llama3.1",
    temperature=0.3
)
def generate_training_data():
    print("🚀 Initializing the 'Teacher' LLM...")
    
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Error: Could not find {INPUT_FILE}")
        return
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        all_chunks = json.load(f)
    random.seed(42)
    sample_chunks = random.sample(all_chunks, 400)
    
    print(f"📂 Loaded {len(all_chunks)} total chunks. Sampling {len(sample_chunks)} for dataset generation...")
    
    system_prompt = SystemMessage(content="""
    ✅ SYSTEM MESSAGE
    You are a Senior Enterprise AI Data Engineer and Hardware Support Specialist. 
    Your task is to generate high-quality, realistic, non-repetitive technical support training data for QLoRA fine-tuning of a Llama-3 model.
    ✅ TASK
    I will provide you with a [Company Name] and a [Manual Text Chunk]. 
    You must generate exactly 3 highly diverse Question-and-Answer pairs based STRICTLY on the provided text.
    ✅ STRICT REQUIREMENTS:
    1. Output Format:
    You must output a valid JSON array of objects matching the Llama-3 conversational format:
    [
      {
        "question": "...",
        "answer": "..."
      }
    ]
    2. Grounding & Hallucination Prevention:
    - ALL technical facts, steps, and specifications in the 'answer' MUST be derived directly from the [Manual Text Chunk].
    - Do not invent specs, error codes, or troubleshooting steps that are not in the text.
    3. Linguistic & Structural Diversity:
    Each of the 3 samples must utilize a completely different structure:
    - Pair 1 (Diagnostic): A user describing a specific symptom or error; the agent provides a step-by-step troubleshooting flow.
    - Pair 2 (Specification/Compatibility): A direct question about a hardware capability; the agent provides a concise, factual answer.
    - Pair 3 (Edge Case/Clarification): A user asking a confusing or multi-part question; the agent uses multi-step reasoning to clarify the policy or procedure.
    4. Brand Voice Variation (Crucial for Multi-Domain):
    - If the Company is Apple, Samsung, or Sony: Use a polite, consumer-friendly, and softly empathetic tone.
    - If the Company is Cisco or Tesla: Use a highly technical, precise, and formal B2B administrative tone.
    5. Phrases to STRICTLY AVOID:
    Do NOT use repetitive AI templates such as:
    - "According to the manual..."
    - "Based on the text provided..."
    - "Please refer to the documentation..."
    - "I apologize for the inconvenience..."
    - "As an AI..."
    6. Self-Correction Logic (The "Critic" Prep):
    - In at least one answer, safely correct a false assumption made by the user in their question using the facts from the text. (e.g., User: "Can I wash this in water?" Agent: "Actually, this component requires dry cleaning only, as moisture will damage the internal sensors. Here is how to clean it...")
    Return ONLY the raw JSON array. Do not include markdown blocks (like ```json).
    """)
    generated_count = 0
    # Open the JSONL file for appending
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        for i, chunk in enumerate(sample_chunks):
            company = chunk.get("Company", "Enterprise")
            content = chunk.get("Content", "")
            
            print(f"  -> Processing chunk {i+1}/100 from {company}...")
            
            user_prompt = HumanMessage(content=f"Company: {company}\nManual Text:\n{content}")
            
            try:
                # Ask the Teacher LLM to generate the Q&A pairs
                response = llm.invoke([system_prompt, user_prompt])
                
                # Clean the response and parse the JSON safely
                raw_text = response.content.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()
                
                qa_pairs = json.loads(raw_text)
                
                # Convert to the standard HuggingFace/Llama-3 Fine-Tuning Format
                for pair in qa_pairs:
                    fine_tuning_record = {
                        "messages": [
                            {"role": "system", "content": f"You are an expert technical support agent for {company}."},
                            {"role": "user", "content": pair["question"]},
                            {"role": "assistant", "content": pair["answer"]}
                        ]
                    }
                    # Write to the JSONL file
                    outfile.write(json.dumps(fine_tuning_record) + "\n")
                    outfile.flush()
                    generated_count += 1
                    
            except json.JSONDecodeError:
                print(f"     ⚠️ Skipping chunk: Ollama did not return valid JSON.")
            except Exception as e:
                print(f"     ⚠️ Skipping chunk due to local execution error: {e}")
    print(f"\n🎉 Dataset Generation Complete!")
    print(f"✅ Successfully wrote {generated_count} Q&A pairs to {OUTPUT_FILE}")
    print("You are now ready to upload this file to Kaggle for QLoRA Fine-Tuning.")
if __name__ == "__main__":
    generate_training_data()