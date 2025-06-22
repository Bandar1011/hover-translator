console.log('Content script loaded!');

let targetLanguage = 'English'; // default language

// Load saved settings when content script loads
(async () => {
  try {
    if (chrome && chrome.storage && chrome.storage.sync) {
      const result = await chrome.storage.sync.get(['targetLanguage']);
      if (result.targetLanguage) {
        targetLanguage = result.targetLanguage;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
})();

function showTooltip(x, y, text) {
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
  
  // Add save button if this is a translation
  if (text !== 'Translating...' && text !== 'Translation failed' && text !== 'Translation error') {
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.cssText = `
      position: absolute;
      top: -20px;
      right: -5px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
      pointer-events: auto;
    `;
    
    // --- DEBUG LOG ---
    console.log('CONTENT SCRIPT: "Save" button is being created and listener is being attached.');
    
    saveButton.addEventListener('mousedown', async (e) => {
      e.stopPropagation();

      // --- DEBUG LOG ---
      console.log('CONTENT SCRIPT: "Save" button successfully clicked/mousedown event fired.');

      const selection = window.getSelection();
      const originalText = selection ? selection.toString().trim() : '';
      
      if (originalText) {
        const flashcard = {
          id: String(Date.now()),
          original: originalText,
          translation: text,
          targetLanguage: targetLanguage,
          createdAt: new Date().toISOString(),
          known: false,
          reviewCount: 0
        };
        
        try {
          const result = await chrome.storage.sync.get(['flashcards']);
          const flashcards = result.flashcards || [];
          flashcards.push(flashcard);
          await chrome.storage.sync.set({ flashcards: flashcards });
          
          // --- DEBUG LOG ---
          console.log('CONTENT SCRIPT: Attempted to save. Flashcards in storage should now be:', flashcards);

          // Notify popup about new flashcard
          chrome.runtime.sendMessage({
            action: 'flashcardSaved',
            flashcard: flashcard,
            totalCount: flashcards.length
          });
          
          saveButton.textContent = '✓';
          saveButton.style.background = '#45a049';
          setTimeout(() => {
            if (saveButton.parentNode) {
              saveButton.parentNode.removeChild(saveButton);
            }
          }, 2000);
        } catch (error) {
          console.error('Error saving flashcard:', error);
          saveButton.textContent = '✗';
          saveButton.style.background = '#f44336';
        }
      }
    });
    
    tooltip.appendChild(saveButton);
    tooltip.style.pointerEvents = 'auto';
  }
}

function hideTooltip() {
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

document.addEventListener('mouseup', async (event) => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    const highlightedText = selection.toString().trim();
    
    if (highlightedText.length > 500) {
      hideTooltip();
      return;
    }
    
    showTooltip(event.clientX, event.clientY, 'Translating...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        word: highlightedText,
        targetLanguage: targetLanguage
      });
      
      const translation = response?.translation || 'Translation failed';
      showTooltip(event.clientX, event.clientY, translation);
    } catch (error) {
      console.error('Translation error:', error);
      showTooltip(event.clientX, event.clientY, 'Translation error');
    }
  } else {
    hideTooltip();
  }
});

document.addEventListener('mousedown', hideTooltip);
document.addEventListener('scroll', hideTooltip);

// Listen for language updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    targetLanguage = message.targetLanguage;
  }
});

