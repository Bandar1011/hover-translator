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

// Global variables to track tooltip position
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

function showTooltip(x, y, text, hiragana = '') {
  let tooltip = document.getElementById('word-hover-translation-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'word-hover-translation-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = 'rgba(23, 23, 23, 0.98)';
    tooltip.style.color = '#ffffff';
    tooltip.style.padding = '12px 16px';
    tooltip.style.borderRadius = '12px';
    tooltip.style.zIndex = 99999;
    tooltip.style.fontSize = '16px';
    tooltip.style.textAlign = 'center';
    tooltip.style.cursor = 'grab';
    tooltip.style.userSelect = 'none';
    tooltip.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    tooltip.style.backdropFilter = 'blur(10px)';
    tooltip.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    tooltip.style.minWidth = '200px';
    document.body.appendChild(tooltip);

    // Add drag functionality
    tooltip.addEventListener('mousedown', (e) => {
      if (e.target.closest('.save-flashcard-container')) return;
      
      isDragging = true;
      dragStartX = e.clientX - tooltip.offsetLeft;
      dragStartY = e.clientY - tooltip.offsetTop;
      
      tooltip.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      
      const newX = e.clientX - dragStartX;
      const newY = e.clientY - dragStartY;
      
      // Keep tooltip within viewport bounds
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const boundedX = Math.min(Math.max(newX, 0), viewportWidth - rect.width);
      const boundedY = Math.min(Math.max(newY, 0), viewportHeight - rect.height);
      
      tooltip.style.left = boundedX + 'px';
      tooltip.style.top = boundedY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        tooltip.style.cursor = 'grab';
      }
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
    tooltipContent = `
      <div style="font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 4px; font-weight: 500;">${hiragana}</div>
      <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 2px;">${text}</div>
    `;
  } else {
    tooltipContent = `
      <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 2px;">${text}</div>
    `;
  }
  
  // Add loading animation for "Translating..."
  if (text === 'Translating...') {
    tooltipContent = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="font-size: 16px; color: rgba(255, 255, 255, 0.7);">${text}</div>
        <div style="display: flex; gap: 3px;">
          <div style="width: 4px; height: 4px; background: rgba(255, 255, 255, 0.7); border-radius: 50%; animation: dot 1s infinite ease-in-out alternate;"></div>
          <div style="width: 4px; height: 4px; background: rgba(255, 255, 255, 0.7); border-radius: 50%; animation: dot 1s infinite ease-in-out alternate 0.2s;"></div>
          <div style="width: 4px; height: 4px; background: rgba(255, 255, 255, 0.7); border-radius: 50%; animation: dot 1s infinite ease-in-out alternate 0.4s;"></div>
        </div>
      </div>
      <style>
        @keyframes dot {
          0% { transform: translateY(0); }
          100% { transform: translateY(-6px); }
        }
      </style>
    `;
  } else if (text === 'Translation failed' || text === 'Translation error') {
    tooltipContent = `
      <div style="color: #ef4444; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12" y2="16"></line>
        </svg>
        <span>${text}</span>
      </div>
    `;
  }
  contentContainer.innerHTML = tooltipContent;
  
  // Only update position if not being dragged
  if (!isDragging) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Start with position near the selected text
    let left = x + 10;
    let top = y + 10;

    // If tooltip would go off right edge, place it to the left of the cursor
    if (left + tooltipRect.width > viewportWidth - 10) {
      left = x - tooltipRect.width - 10;
    }

    // If tooltip would go off bottom edge, place it above the cursor
    if (top + tooltipRect.height > viewportHeight - 10) {
      top = y - tooltipRect.height - 10;
    }

    // Ensure tooltip stays within viewport bounds
    left = Math.min(Math.max(left, 10), viewportWidth - tooltipRect.width - 10);
    top = Math.min(Math.max(top, 10), viewportHeight - tooltipRect.height - 10);

    // Apply the position
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

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
      align-items: center;
      gap: 8px;
      z-index: 1000000;
      margin-top: 8px;
    `;

    // Create deck select dropdown
    const deckSelect = document.createElement('select');
    deckSelect.className = 'deck-select';
    deckSelect.style.cssText = `
      display: none;
      padding: 10px 12px;
      font-size: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      background: rgba(23, 23, 23, 0.98);
      color: #ffffff;
      cursor: pointer;
      min-width: 180px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      margin-bottom: 8px;
      appearance: none;
      transition: all 0.2s ease;
      background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
      background-repeat: no-repeat;
      background-position: right 12px top 50%;
      background-size: 10px auto;
    `;

    // Add hover effect for select
    deckSelect.addEventListener('mouseover', () => {
      deckSelect.style.background = 'rgba(32, 32, 32, 0.98)';
      deckSelect.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    deckSelect.addEventListener('mouseout', () => {
      deckSelect.style.background = 'rgba(23, 23, 23, 0.98)';
      deckSelect.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    // Add the container to the body instead of the tooltip
    document.body.appendChild(saveContainer);

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Add';
    saveButton.className = 'save-flashcard-btn';
    console.log('Save button created:', saveButton);
    saveButton.style.cssText = `
      background: rgba(23, 23, 23, 0.98);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    `;

    // Add hover effects
    saveButton.addEventListener('mouseover', () => {
      saveButton.style.background = 'rgba(32, 32, 32, 0.98)';
      saveButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      saveButton.style.transform = 'translateY(-1px)';
    });
    saveButton.addEventListener('mouseout', () => {
      saveButton.style.background = 'rgba(23, 23, 23, 0.98)';
      saveButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      saveButton.style.transform = 'translateY(0)';
    });
    
    // Add click handler for the save button
    saveButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Save button clicked, current text:', saveButton.textContent);
      
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
          deckSelect.innerHTML = '<option value="" disabled selected>Choose a deck:</option>';
          decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck.id;
            option.textContent = `${deck.name} (${deck.cards.length} cards)`;
            deckSelect.appendChild(option);
          });
          
          // Show deck select and change button text
          deckSelect.style.display = 'block';
          saveButton.textContent = 'Save';
          
          console.log('Showing deck select dropdown'); // Debug log
          console.log('Dropdown display style:', deckSelect.style.display);
          
        } catch (error) {
          console.error('Error loading decks:', error);
        }
      } else if (saveButton.textContent === 'Save') {
        if (!deckSelect.value) {
          // Shake the dropdown if no deck is selected
          deckSelect.style.transform = 'translateX(5px)';
          setTimeout(() => {
            deckSelect.style.transform = 'translateX(-5px)';
            setTimeout(() => {
              deckSelect.style.transform = 'translateX(0)';
            }, 100);
          }, 100);
          return;
        }
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
              
              // Show success state
              const originalButtonText = saveButton.textContent;
              saveButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              `;
              saveButton.style.background = 'rgba(22, 163, 74, 0.2)';
              saveButton.style.borderColor = 'rgba(74, 222, 128, 0.2)';
              saveButton.style.color = '#4ade80';
              deckSelect.style.display = 'none';
              
              // Reset after 1.5 seconds
              setTimeout(() => {
                saveButton.textContent = 'Add';
                saveButton.style.background = 'rgba(23, 23, 23, 0.98)';
                saveButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                saveButton.style.color = 'white';
                saveButton.disabled = false;
              }, 1500);
              // Clear the processing state
              saveContainer.removeAttribute('data-processing');
            }
          } catch (error) {
            console.error('Error saving flashcard:', error);
            saveButton.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Error
            `;
            saveButton.style.background = '#1a1a1a';
            saveButton.style.display = 'flex';
            saveButton.style.alignItems = 'center';
            saveButton.style.justifyContent = 'center';
            saveButton.style.gap = '4px';
          }
        }
      }
    });
    
    console.log('Event listener attached to save button');
    
    // Add a simple test click handler
    saveButton.onclick = function() {
      console.log('ONCLICK HANDLER TRIGGERED!');
    };
    
    // Position the container near the tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    saveContainer.style.top = (tooltipRect.top - 40) + 'px';
    saveContainer.style.left = (tooltipRect.right - 160) + 'px';

    // Add elements to container (dropdown first, then button)
    saveContainer.appendChild(deckSelect);
    saveContainer.appendChild(saveButton);
    tooltip.style.pointerEvents = 'auto';
  }
}

// Handle clicks outside the save container
document.addEventListener('mousedown', (e) => {
  console.log('Global mousedown event triggered');
  const saveContainer = document.querySelector('.save-flashcard-container');
  if (!saveContainer) return;

  const deckSelect = saveContainer.querySelector('.deck-select');
  const saveButton = saveContainer.querySelector('.save-flashcard-btn');
  
  console.log('Dropdown visible?', deckSelect && deckSelect.style.display === 'block');
  
  // If clicking inside the save container, don't do anything
  if (e.target.closest('.save-flashcard-container')) {
    console.log('Clicked inside save container, doing nothing');
    return;
  }
  
  // If dropdown is visible and clicking outside, hide it
  if (deckSelect && deckSelect.style.display === 'block') {
    console.log('Hiding dropdown because clicked outside');
    deckSelect.style.display = 'none';
    if (saveButton) saveButton.textContent = 'Add';
    return;
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
  
  // Reset selection and hide tooltip
  lastSelection = '';
  tooltip.style.display = 'none';
}

let debounceTimer; // Timer for debouncing API requests
// Store the last selection to compare with new ones
let lastSelection = '';

document.addEventListener('mouseup', async (event) => {
  const selection = window.getSelection();
  const currentSelection = selection.toString().trim();
  
  // Only proceed if we have a new, non-empty selection that's different from the last one
  if (selection && currentSelection.length > 0 && currentSelection !== lastSelection) {
    lastSelection = currentSelection;
    const highlightedText = currentSelection;
    
    if (highlightedText.length > 500) {
      hideTooltip();
      return;
    }
    
    // Remove any existing tooltip
    const existingTooltip = document.getElementById('word-hover-translation-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
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

  // If we click inside the tooltip, don't hide it
  if (e.target.closest('#word-hover-translation-tooltip')) {
    return;
  }

  // Only hide tooltip if clicking completely outside everything
  if (!e.target.closest('.save-flashcard-container')) {
    const saveContainer = document.querySelector('.save-flashcard-container');
    const deckSelect = saveContainer?.querySelector('.deck-select');
    
    // If dropdown is not visible, hide the whole tooltip
    if (!deckSelect || deckSelect.style.display !== 'block') {
      hideTooltip();
    }
  }
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

// Listen for language updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    targetLanguage = message.targetLanguage;
  }
});