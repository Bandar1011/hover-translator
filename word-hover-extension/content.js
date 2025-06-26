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

function showTooltip(x, y, text, hiragana = '') {
  let tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'word-hover-translation-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = 'rgba(34, 34, 34, 0.95)';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.zIndex = 99999;
    tooltip.style.fontSize = '16px';
    tooltip.style.textAlign = 'center';
    document.body.appendChild(tooltip);
  }

  // Create the content for the tooltip, with hiragana on top if it exists.
  let tooltipContent = '';
  if (hiragana) {
    tooltipContent = `<div style="font-size: 13px; color: #ccc;">${hiragana}</div><div style="font-weight: bold;">${text}</div>`;
  } else {
    tooltipContent = `<div style="font-weight: bold;">${text}</div>`;
  }
  tooltip.innerHTML = tooltipContent; // Use innerHTML to set the content.
  
  tooltip.style.left = x + 10 + 'px';
  tooltip.style.top = y + 10 + 'px';
  tooltip.style.display = 'block';
  
  // Add save button if this is a translation
  if (text !== 'Translating...' && text !== 'Translation failed' && text !== 'Translation error') {
    // If a save button already exists from a previous hover, remove it first.
    const existingButton = tooltip.querySelector('.save-flashcard-btn');
    if (existingButton) {
        existingButton.remove();
    }

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-flashcard-btn';
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
    `;
    
    saveButton.addEventListener('mousedown', async (e) => {
      e.stopPropagation();
      const originalText = window.getSelection().toString().trim();
      
      if (originalText) {
        // Use the data passed directly to showTooltip, no need to request again.
        const flashcard = {
          id: String(Date.now()),
          original: originalText,
          translation: text,
          hiragana: hiragana,
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

          chrome.runtime.sendMessage({
            action: 'flashcardSaved',
            totalCount: flashcards.length
          });
          
          saveButton.textContent = '✓';
          saveButton.disabled = true;
          saveButton.style.background = '#45a049';
        } catch (error) {
          console.error('Error saving flashcard:', error);
          saveButton.textContent = '✗';
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

let debounceTimer; // Timer for debouncing API requests
document.addEventListener('mouseup', async (event) => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    const highlightedText = selection.toString().trim();
    
    if (highlightedText.length > 500) {
      hideTooltip();
      return;
    }
    
    // Show "Translating..." immediately for responsiveness
    showTooltip(event.clientX, event.clientY, 'Translating...');
    
    // Clear the previous timer to reset the debounce period
    clearTimeout(debounceTimer);
    
    // Set a new timer to make the API call after a short delay
    debounceTimer = setTimeout(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          word: highlightedText,
          targetLanguage: targetLanguage
        });
        
        const { translation, hiragana } = response || { translation: 'Translation failed', hiragana: '' };
        // We need to re-calculate the tooltip position in case the user has scrolled
        const latestSelection = window.getSelection().getRangeAt(0).getBoundingClientRect();
        showTooltip(latestSelection.right, latestSelection.bottom, translation, hiragana);
      } catch (error) {
        console.error('Translation error:', error);
        // Show error at the last known position
        showTooltip(event.clientX, event.clientY, 'Translation error');
      }
    }, 400); // 400ms delay

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

