console.log('Content script loaded!');

let targetLanguage = 'English'; // default language

function showTooltip(x, y, text) {
  console.log('showTooltip called with:', text);
  let tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'word-hover-translation-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = '#222';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.zIndex = 99999;
    tooltip.style.fontSize = '16px';
    tooltip.style.pointerEvents = 'none';
    document.body.appendChild(tooltip);
  }
  tooltip.textContent = text;
  tooltip.style.left = x + 10 + 'px';
  tooltip.style.top = y + 10 + 'px';
  tooltip.style.display = 'block';
}

function hideTooltip() {
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

async function lookupJisho(word) {
  try {
    const response = await fetch(`http://localhost:3005/api/jisho?word=${encodeURIComponent(word)}`);
    if (!response.ok) return 'No result found';
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const japanese = data.data[0].japanese[0].word || data.data[0].japanese[0].reading;
      const english = data.data[0].senses[0].english_definitions.join(', ');
      return `${japanese} — ${english}`;
    }
    return 'No result found';
  } catch (err) {
    console.error('Proxy fetch error:', err);
    return 'Lookup error';
  }
}

document.addEventListener('mouseup', async (event) => {
  console.log('mouseup event triggered');
  const selection = window.getSelection();
  console.log('selection:', selection ? selection.toString() : 'no selection');
  if (selection && selection.toString().trim().length > 0) {
    const highlightedText = selection.toString().trim();
    console.log('showing tooltip for:', highlightedText);
    
    // Show "Looking up..." first
    showTooltip(event.clientX, event.clientY, 'Looking up...');
    
    // Get translation
    const result = await lookupJisho(highlightedText);
    console.log('Final translation result:', result);
    
    // Show translation
    showTooltip(event.clientX, event.clientY, result);
  } else {
    console.log('hiding tooltip - no selection');
    hideTooltip();
  }
});

document.addEventListener('mousedown', hideTooltip);
document.addEventListener('scroll', hideTooltip);

// Listen for language updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    targetLanguage = message.targetLanguage;
    console.log('Language updated to:', targetLanguage);
  }
}); 