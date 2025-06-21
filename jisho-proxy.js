const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const apiKey = 'AIzaSyAYRB-B9wg3Rs-Kc5cuSDzASM4Eo2Iuzu4';

app.get('/api/jisho', async (req, res) => {
  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'Missing word parameter' });
  }
  try {
    const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Gemini translation endpoint
app.post('/api/gemini', async (req, res) => {
  const { word, targetLanguage } = req.body;
  if (!word || !targetLanguage) {
    return res.status(400).json({ error: 'Missing word or targetLanguage parameter' });
  }
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0:generateContent?key=${apiKey}`;
    const prompt = `Translate the following word to ${targetLanguage}: ${word}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data, null, 2));
    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No translation';
    res.json({ translation });
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini proxy server running on http://localhost:${PORT}`);
}); 