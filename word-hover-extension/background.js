// This will handle background tasks for the extension
// For now, it's just a placeholder

chrome.runtime.onInstalled.addListener(() => {
  console.log('Word Hover Translator extension installed.');
  
  // Test API connectivity on installation
  setTimeout(() => {
    testAPIConnectivity();
  }, 2000);
});

async function testAPIConnectivity() {
  console.log('🧪 Testing API connectivity...');
  
  try {
    const apiKey = 'AIzaSyAYRB-B9wg3Rs-Kc5cuSDzASM4Eo2Iuzu4';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
    
    const testBody = {
      contents: [{ 
        parts: [{ text: 'Test message. Respond with: {"test": "success"}' }] 
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50
      }
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testBody)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connectivity test PASSED');
      console.log('Test response:', data);
    } else {
      const errorText = await response.text();
      console.error('❌ API connectivity test FAILED');
      console.error('Status:', response.status, response.statusText);
      console.error('Error:', errorText);
      
      // Specific error analysis
      if (response.status === 429) {
        console.error('🚫 RATE LIMIT: API quota exceeded or too many requests');
      } else if (response.status === 401) {
        console.error('🔑 AUTH ERROR: Invalid API key');
      } else if (response.status === 403) {
        console.error('🚫 ACCESS DENIED: API key lacks permission');
      } else if (response.status === 404) {
        console.error('❓ NOT FOUND: Model may not exist or endpoint changed');
      }
    }
    
  } catch (error) {
    console.error('❌ API connectivity test FAILED with exception:');
    console.error(error);
    
    if (error.message.includes('Failed to fetch')) {
      console.error('🌐 NETWORK ERROR: Check internet connection or firewall');
    }
  }
}

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
    console.log('Request URL:', endpoint);
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
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
    
    // Detailed error analysis for debugging
    let errorMessage = 'Translation failed';
    let debugInfo = '';
    
    if (err.message.includes('API error: 429')) {
      errorMessage = 'API Rate Limit Exceeded';
      debugInfo = 'The API has reached its quota or rate limit. Try again later.';
    } else if (err.message.includes('API error: 401')) {
      errorMessage = 'API Authentication Failed';
      debugInfo = 'Invalid API key or authentication issue.';
    } else if (err.message.includes('API error: 403')) {
      errorMessage = 'API Access Forbidden';
      debugInfo = 'API key may not have permission for this service.';
    } else if (err.message.includes('API error: 404')) {
      errorMessage = 'API Model Not Found';
      debugInfo = 'The Gemini model may have been changed or deprecated.';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      errorMessage = 'Network Connection Failed';
      debugInfo = 'Check internet connection or firewall settings.';
    } else if (err.message.includes('Failed to parse JSON')) {
      errorMessage = 'API Response Format Error';
      debugInfo = 'The API returned unexpected response format.';
    } else {
      debugInfo = err.message;
    }
    
    console.error('🔍 DEBUG INFO:');
    console.error('Error Type:', errorMessage);
    console.error('Details:', debugInfo);
    console.error('Full Error:', err);
    console.error('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
    console.error('Endpoint:', endpoint);
    
    // Send detailed error back to content script
    sendResponse({ 
      translation: `${errorMessage}: ${debugInfo}`, 
      hiragana: '',
      error: true,
      errorType: errorMessage,
      debugInfo: debugInfo
    });
  } finally {
    // IMPORTANT: Open the gate again, whether the request succeeded or failed.
    isRequestInProgress = false;
  }
}
