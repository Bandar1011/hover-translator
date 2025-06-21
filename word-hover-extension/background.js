// This will handle background tasks for the extension
// For now, it's just a placeholder

chrome.runtime.onInstalled.addListener(() => {
  console.log('Word Hover Translator extension installed.');
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Background received message:', message);
  if (message.action === 'translate') {
    const apiKey = 'AIzaSyAYRB-B9wg3Rs-Kc5cuSDzASM4Eo2Iuzu4';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0:generateContent?key=' + apiKey;
    const prompt = `Translate the following word to ${message.targetLanguage}: ${message.word}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    let didRespond = false;
    const timeout = setTimeout(() => {
      if (!didRespond) {
        sendResponse({ translation: 'Translation error: timeout' });
        didRespond = true;
      }
    }, 4000); // 4 seconds

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const translation = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No translation';
      if (!didRespond) {
        sendResponse({ translation });
        didRespond = true;
        clearTimeout(timeout);
      }
    } catch (err) {
      if (!didRespond) {
        sendResponse({ translation: 'Translation error: ' + err.message });
        didRespond = true;
        clearTimeout(timeout);
      }
    }
    return true;
  }
  if (message.action === 'jishoLookup') {
    try {
      const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(message.word)}`);
      if (!response.ok) {
        sendResponse({ result: 'No result found' });
        return true;
      }
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const japanese = data.data[0].japanese[0].word || data.data[0].japanese[0].reading;
        const english = data.data[0].senses[0].english_definitions.join(', ');
        sendResponse({ result: `${japanese} — ${english}` });
      } else {
        sendResponse({ result: 'No result found' });
      }
    } catch (err) {
      sendResponse({ result: 'Lookup error' });
    }
    return true;
  }
});

async function lookupJisho(word) {
  try {
    const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);
    if (!response.ok) {
      console.error('Jisho fetch failed:', response.status, response.statusText);
      return 'No result found';
    }
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const japanese = data.data[0].japanese[0].word || data.data[0].japanese[0].reading;
      const english = data.data[0].senses[0].english_definitions.join(', ');
      return `${japanese} — ${english}`;
    }
    return 'No result found';
  } catch (err) {
    console.error('Jisho fetch error:', err);
    return 'Lookup error';
  }
} 