console.log('Content script loaded!');

let targetLanguage = 'English'; // default language

// Load saved settings when content script loads
(async () => {
  try {
    if (chrome && chrome.storage && chrome.storage.sync) {
      const result = await chrome.storage.sync.get(['targetLanguage']);
      if (result.targetLanguage) {
        targetLanguage = result.targetLanguage;
        console.log('Loaded target language:', targetLanguage);
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
})();

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


document.addEventListener('mouseup', async (event) => {
  console.log('mouseup event triggered');
  const selection = window.getSelection();
  console.log('selection:', selection ? selection.toString() : 'no selection');
  if (selection && selection.toString().trim().length > 0) {
    const highlightedText = selection.toString().trim();
    
    // Limit text length to avoid very long translations
    if (highlightedText.length > 500) {
      console.log('Text too long, skipping translation');
      hideTooltip();
      return;
    }
    
    console.log('showing tooltip for:', highlightedText);
    
    // Show "Translating..." first
    showTooltip(event.clientX, event.clientY, 'Translating...');
    
    // Get translation from Gemini API via background script
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        word: highlightedText,
        targetLanguage: targetLanguage
      });
      
      console.log('Translation response:', response);
      const translation = response?.translation || 'Translation failed';
      
      // Show translation
      showTooltip(event.clientX, event.clientY, translation);
    } catch (error) {
      console.error('Translation error:', error);
      showTooltip(event.clientX, event.clientY, 'Translation error');
    }
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
