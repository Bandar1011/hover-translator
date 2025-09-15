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

  // Create or get the content container
  let contentContainer = tooltip.querySelector('.tooltip-content');
  if (!contentContainer) {
    contentContainer = document.createElement('div');
    contentContainer.className = 'tooltip-content';
    tooltip.appendChild(contentContainer);
  }

  // Update the content
  let tooltipContent = '';
  if (hiragana) {
    tooltipContent = `<div style="font-size: 13px; color: #ccc;">${hiragana}</div><div style="font-weight: bold;">${text}</div>`;
  } else {
    tooltipContent = `<div style="font-weight: bold;">${text}</div>`;
  }
  contentContainer.innerHTML = tooltipContent;
  
  tooltip.style.left = x + 10 + 'px';
  tooltip.style.top = y + 10 + 'px';
  tooltip.style.display = 'block';
  
  // Add save button if this is a translation
  if (text !== 'Translating...' && text !== 'Translation failed' && text !== 'Translation error') {
    // Remove existing save container if it exists
    const existingContainer = tooltip.querySelector('.save-flashcard-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    // Create container for save button and deck select
    const saveContainer = document.createElement('div');
    saveContainer.className = 'save-flashcard-container';
    saveContainer.style.cssText = `
      position: absolute;
      top: -30px;
      right: -5px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
    `;

    // Create deck select dropdown
    const deckSelect = document.createElement('select');
    deckSelect.className = 'deck-select';
    deckSelect.style.cssText = `
      display: none;
      padding: 4px 6px;
      font-size: 12px;
      border: 1px solid #ccc;
      border-radius: 3px;
      background: white;
      color: black;
      cursor: pointer;
      max-width: 150px;
      position: relative;
      z-index: 100000;
      margin-bottom: 5px;
    `;

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Add';
    saveButton.className = 'save-flashcard-btn';
    saveButton.style.cssText = `
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
    `;
    
    // Add click handler for the save button
    saveButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (saveButton.textContent === 'Add') {
        // Show deck selection
        try {
          const result = await chrome.storage.sync.get(['decks']);
          const decks = result.decks || [];
          
          // If no decks exist, create Deck 1
          if (decks.length === 0) {
            decks.push({
              id: 'deck1',
              name: 'Deck 1',
              cards: []
            });
            await chrome.storage.sync.set({ decks: decks });
          }
          
          // Populate deck select
          deckSelect.innerHTML = '';
          decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck.id;
            option.textContent = `${deck.name} (${deck.cards.length} cards)`;
            deckSelect.appendChild(option);
          });
          
          // Show deck select and change button text
          deckSelect.style.display = 'block';
          saveButton.textContent = 'Save';
        } catch (error) {
          console.error('Error loading decks:', error);
        }
      } else if (saveButton.textContent === 'Save') {
        // Save to selected deck
        const originalText = window.getSelection().toString().trim();
        const selectedDeckId = deckSelect.value;
        
        if (originalText && selectedDeckId) {
          const newCard = {
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
            const result = await chrome.storage.sync.get(['decks']);
            const decks = result.decks || [];
            const deckIndex = decks.findIndex(d => d.id === selectedDeckId);
            
            if (deckIndex !== -1) {
              decks[deckIndex].cards.push(newCard);
              await chrome.storage.sync.set({ decks: decks });

              // Notify popup about the new card
              chrome.runtime.sendMessage({
                action: 'flashcardSaved',
                deckId: selectedDeckId,
                totalCount: decks[deckIndex].cards.length
              });
              
              saveButton.textContent = '✓';
              saveButton.disabled = true;
              saveButton.style.background = '#45a049';
              deckSelect.style.display = 'none';
              // Clear the processing state
              saveContainer.removeAttribute('data-processing');
            }
          } catch (error) {
            console.error('Error saving flashcard:', error);
            saveButton.textContent = '✗';
          }
        }
      }
    });
    
    // Add elements to container and tooltip
    saveContainer.appendChild(deckSelect);
    saveContainer.appendChild(saveButton);
    tooltip.appendChild(saveContainer);
    tooltip.style.pointerEvents = 'auto';
  }
}

// Only hide dropdown when clicking the Add button again
document.addEventListener('mousedown', (e) => {
  const saveButton = e.target.closest('.save-flashcard-btn');
  if (saveButton && saveButton.textContent === 'Add') {
    const deckSelect = document.querySelector('.deck-select');
    if (deckSelect && deckSelect.style.display === 'block') {
      deckSelect.style.display = 'none';
    }
  }
});

function hideTooltip() {
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (tooltip) {
    const saveButton = tooltip.querySelector('.save-flashcard-btn');
    // Only hide the tooltip if we're not in the middle of selecting a deck
    if (!saveButton || saveButton.textContent !== 'Save') {
      tooltip.style.display = 'none';
    }
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
        
        // If the response was null, it means a request was ignored, so do nothing.
        if (translation === null) {
          return;
        }

        // We need to re-calculate the tooltip position in case the user has scrolled
        const latestSelection = window.getSelection().getRangeAt(0).getBoundingClientRect();
        showTooltip(latestSelection.right, latestSelection.bottom, translation, hiragana);
      } catch (error) {
        console.error('Translation error:', error);
        // Show error at the last known position
        showTooltip(event.clientX, event.clientY, 'Translation error');
      }
    }, 1000); // 1000ms (1 second) delay

  } else {
    hideTooltip();
  }
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.save-flashcard-container') && !e.target.closest('#word-hover-translation-tooltip')) {
    hideTooltip();
  }
});
document.addEventListener('scroll', hideTooltip);

// Listen for language updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    targetLanguage = message.targetLanguage;
  }
});