import pandas as pd
import requests
import json
import ollama
import time
import uuid

# ==========================================
# CONFIGURATION
# ==========================================
API_URL = "http://127.0.0.1:8000/api/chat"
DATASET_PATH = "ground_truth.csv"
OUTPUT_PATH = "evaluation_report.csv"
JUDGE_MODEL = "hf.co/Sunngttssu/enterprise-support-bot"

print("🚀 Initializing Local RAGAS Evaluation Pipeline...")

# ==========================================
# METRIC: LLM-AS-A-JUDGE SCORING
# ==========================================
def score_response(question, expected, actual):
    """Uses local Llama-3 to score the accuracy and faithfulness of the response."""
    prompt = f"""
    You are an impartial QA Judge grading an Enterprise AI.
    Question Asked: "{question}"
    Expected Correct Answer: "{expected}"
    AI's Actual Answer: "{actual}"
    
    Evaluate the AI's Actual Answer based on factual overlap with the Expected Answer.
    Score it from 0 to 10. (10 = perfect match in facts, 0 = complete hallucination or wrong fact).
    Respond strictly in JSON format. Example: {{"score": 8, "reason": "Captured the BIOS update but missed the version number."}}
    """
    
    try:
        response = ollama.chat(
            model=JUDGE_MODEL, 
            messages=[
                {"role": "system", "content": "You are a strict JSON formatting judge."},
                {"role": "user", "content": prompt}
            ],
            format="json"
        )
        data = json.loads(response['message']['content'])
        return int(data.get("score", 0)), data.get("reason", "Parsing failed.")
    except Exception as e:
        return 0, f"Judge Error: {e}"

# ==========================================
# MAIN EXECUTION LOOP
# ==========================================
def run_evaluation():
    try:
        df = pd.read_csv(DATASET_PATH)
    except FileNotFoundError:
        print(f"❌ Error: Could not find {DATASET_PATH}. Please create it first.")
        return

    results = []
    total_score = 0
    
    print(f"📊 Found {len(df)} test cases. Commencing automated testing...\n")
    
    for index, row in df.iterrows():
        question = row['question']
        expected = row['expected_answer']
        print(f"🔄 Testing [{index+1}/{len(df)}]: {question[:40]}...")
        
        # --- CRITICAL UPDATE: Prevent Memory Bleed ---
        # Generate a unique session ID for each test so the AI starts with a blank memory
        test_session_id = f"eval_{uuid.uuid4().hex[:8]}"
        
        # 1. Ping the FastAPI Backend
        start_time = time.time()
        try:
            api_resp = requests.post(API_URL, json={"message": question, "session_id": test_session_id}, timeout=30)
            actual_answer = api_resp.json().get("response", "No response key found.")
        except Exception as e:
            actual_answer = f"API Failure: {e}"
            
        latency = round(time.time() - start_time, 2)
        
        # 2. Grade the Response
        score, reason = score_response(question, expected, actual_answer)
        total_score += score
        
        # 3. Log the Result
        results.append({
            "Question": question,
            "Category": row.get('category', 'Uncategorized'),
            "Expected": expected,
            "Actual": actual_answer,
            "Score (0-10)": score,
            "Latency (s)": latency,
            "Judge Reason": reason
        })
        
        print(f"   -> Score: {score}/10 | Latency: {latency}s")

    # Save final report
    results_df = pd.DataFrame(results)
    results_df.to_csv(OUTPUT_PATH, index=False)
    
    avg_score = total_score / len(df)
    print(f"\n✅ Evaluation Complete! Average System Accuracy: {avg_score:.1f}/10")
    print(f"📄 Detailed report saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    run_evaluation()