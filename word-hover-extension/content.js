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
    tooltip.style.cursor = 'move';
    tooltip.style.userSelect = 'none';
    tooltip.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    document.body.appendChild(tooltip);

    // Add drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    tooltip.addEventListener('mousedown', (e) => {
      if (e.target.closest('.save-flashcard-container')) return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === tooltip) {
        isDragging = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, tooltip);
      }
    });

    document.addEventListener('mouseup', () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    });
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
  
  // Get tooltip dimensions
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate position to keep tooltip within viewport
  let left = x + 10;
  let top = y + 10;

  // Adjust horizontal position if needed
  if (left + tooltipRect.width > viewportWidth) {
    left = x - tooltipRect.width - 10;
  }

  // Adjust vertical position if needed
  if (top + tooltipRect.height > viewportHeight) {
    top = y - tooltipRect.height - 10;
  }

  // Ensure tooltip doesn't go off the left or top edge
  left = Math.max(10, left);
  top = Math.max(10, top);

  tooltip.style.transform = '';
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
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
      position: fixed;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
      z-index: 1000000;
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
      min-width: 150px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      margin-bottom: 5px;
    `;
    
    // Add the container to the body instead of the tooltip
    document.body.appendChild(saveContainer);

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
    
    // Position the container near the tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    saveContainer.style.top = (tooltipRect.top - 40) + 'px';
    saveContainer.style.left = (tooltipRect.right - 160) + 'px';

    // Add elements to container
    saveContainer.appendChild(deckSelect);
    saveContainer.appendChild(saveButton);
    tooltip.style.pointerEvents = 'auto';
  }
}

// Handle clicks outside the save container
document.addEventListener('mousedown', (e) => {
  const saveContainer = document.querySelector('.save-flashcard-container');
  if (!saveContainer) return;

  const deckSelect = saveContainer.querySelector('.deck-select');
  const saveButton = saveContainer.querySelector('.save-flashcard-btn');
  
  // If clicking the Add button while dropdown is visible, hide it
  if (e.target.closest('.save-flashcard-btn') && saveButton.textContent === 'Add') {
    if (deckSelect && deckSelect.style.display === 'block') {
      deckSelect.style.display = 'none';
    }
    return;
  }
  
  // If clicking outside while dropdown is visible, ignore the click
  if (deckSelect && deckSelect.style.display === 'block') {
    if (!e.target.closest('.save-flashcard-container')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
});

function hideTooltip() {
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) return;

  const saveContainer = document.querySelector('.save-flashcard-container');
  const deckSelect = saveContainer?.querySelector('.deck-select');
  
  // Never hide if the deck select is visible
  if (deckSelect && deckSelect.style.display === 'block') {
    return;
  }
  
  // Remove the save container if it exists
  if (saveContainer) {
    saveContainer.remove();
  }
  
  tooltip.style.display = 'none';
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
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) return;

  const saveButton = tooltip.querySelector('.save-flashcard-btn');
  const deckSelect = tooltip.querySelector('.deck-select');
  
  // If we're in the process of selecting a deck (dropdown is visible), don't hide anything
  if (deckSelect && deckSelect.style.display === 'block') {
    return;
  }

  // If we click inside the tooltip or save container, don't hide
  if (e.target.closest('.save-flashcard-container') || e.target.closest('#word-hover-translation-tooltip')) {
    return;
  }

  // Otherwise, hide the tooltip
  tooltip.style.display = 'none';
});

// Only hide on scroll if we're not selecting a deck
document.addEventListener('scroll', () => {
  const tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) return;

  const deckSelect = tooltip.querySelector('.deck-select');
  if (deckSelect && deckSelect.style.display === 'block') {
    return;
  }

  tooltip.style.display = 'none';
});

// Helper function for dragging
function setTranslate(xPos, yPos, el) {
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rect = el.getBoundingClientRect();

  // Keep tooltip within viewport bounds
  xPos = Math.min(Math.max(xPos, 0), viewportWidth - rect.width);
  yPos = Math.min(Math.max(yPos, 0), viewportHeight - rect.height);

  el.style.transform = 'translate3d(' + xPos + 'px, ' + yPos + 'px, 0)';
}

// Listen for language updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    targetLanguage = message.targetLanguage;
  }
});