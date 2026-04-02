/**
 * ollamaApi.js
 * Fetches responses from the new Python FastAPI backend.
 */

const BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * Checks if backend is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a chat message to the FastAPI backend.
 * @param {string} userText  User's input text
 * @param {AbortSignal} signal   AbortSignal to cancel the request
 * @returns {Promise<string>} The response text
 */
export async function sendChatMessage(userText, signal) {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Backend API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.response;
}
