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
    
    // Create a more specific prompt for better translation
    const prompt = `Translate the following text from any language to ${message.targetLanguage}. Only provide the translation, no explanations: "${message.word}"`;
    
    const body = {
      contents: [{ 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100
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
    
    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No translation available';
    
    console.log('Sending translation:', translation);
    sendResponse({ translation });
    
  } catch (err) {
    console.error('Translation error:', err);
    sendResponse({ translation: `Translation failed: ${err.message}` });
  }
}
