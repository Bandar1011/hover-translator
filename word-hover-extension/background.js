// This will handle background tasks for the extension
// For now, it's just a placeholder

chrome.runtime.onInstalled.addListener(() => {
  console.log('Word Hover Translator extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  if (message.action === 'translate') {
    // Handle async operation
    handleTranslation(message, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

let isRequestInProgress = false; // A "gate" to prevent concurrent requests

async function handleTranslation(message, sendResponse) {
  // If a request is already happening, ignore this new one.
  if (isRequestInProgress) {
    console.log('Request ignored: Another translation is already in progress.');
    // It's important to still call sendResponse to close the message channel,
    // but we can send an empty/non-committal response.
    sendResponse({ translation: null, hiragana: null }); // or some indicator of being busy
    return;
  }
  
  // Close the gate
  isRequestInProgress = true;

  try {
    // Note: In production, you should store the API key securely
    const apiKey = 'AIzaSyAYRB-B9wg3Rs-Kc5cuSDzASM4Eo2Iuzu4';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
    
    // New, clearer prompt with valid JSON examples to ensure reliable responses.
    const prompt = `Analyze the following text: "${message.word}".
Translate it to ${message.targetLanguage}.
You MUST respond with ONLY a valid, single-line JSON object with two keys: "translation" and "hiragana".

- "translation": This key's value must be the translated text.
- "hiragana": If the original text contains Japanese Kanji, this key's value must be the complete Hiragana reading. If there is no Kanji, the value must be an empty string.

Correct Example 1:
Original Text: "日本語"
Response: {"translation": "Japanese", "hiragana": "にほんご"}

Correct Example 2:
Original Text: "こんにちは"
Response: {"translation": "Hello", "hiragana": ""}

Do not add any other text, explanations, or markdown formatting outside of the JSON object.`;
    
    const body = {
      contents: [{ 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    };

    console.log('Making API request to Gemini...');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Gemini API response:', data);
    
    // The response from Gemini is expected to be a string of JSON. We need to parse it.
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    let parsedResponse = {};
    try {
        // Clean the response to remove any markdown formatting before parsing.
        const cleanedText = responseText.replace(/^```json\s*/, '').replace(/```$/, '');
        parsedResponse = JSON.parse(cleanedText);
    } catch (e) {
        // If parsing fails, it's likely the model didn't return valid JSON.
        console.error("Failed to parse JSON response from Gemini:", responseText);
        // Fallback: treat the entire response as the translation
        parsedResponse = { 
            translation: responseText || 'No translation available', 
            hiragana: '' 
        };
    }

    const { translation, hiragana } = parsedResponse;
    
    console.log('Sending response:', { translation, hiragana });
    sendResponse({ translation, hiragana });
    
  } catch (err) {
    console.error('Translation error:', err);
    sendResponse({ translation: `Translation failed: ${err.message}`, hiragana: '' });
  } finally {
    // IMPORTANT: Open the gate again, whether the request succeeded or failed.
    isRequestInProgress = false;
  }
}
