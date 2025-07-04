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

async function handleTranslation(message, sendResponse) {
  try {
    // Note: In production, you should store the API key securely
    const apiKey = 'AIzaSyAYRB-B9wg3Rs-Kc5cuSDzASM4Eo2Iuzu4';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey;
    
    // New prompt to get translation and Hiragana for the source word if it contains Kanji.
    const prompt = `Analyze the following text: "${message.word}".
Respond with ONLY a valid, single-line JSON object with two keys: "translation" and "hiragana".
1. "translation": Translate the text into ${message.targetLanguage} and dont put the word "translation" in the response.
2. "hiragana": If the original text contains any Japanese Kanji characters, provide the complete Hiragana reading for the original text. Otherwise, this must be an empty string.
Example Request: { "word": "日本語", "targetLanguage": "English" }
Example Response: { "Japanese", "hiragana": "にほんご" }
Example Request: { "word": "こんにちは", "targetLanguage": "English" }
Example Response: {  "Hello" }
Do not add any other explanations, comments, or markdown formatting.`;
    
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
  }
}
