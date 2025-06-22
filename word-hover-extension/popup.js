// Save settings when button is clicked
document.addEventListener('DOMContentLoaded', () => {
    // --- EVENT LISTENERS ---

    // 1. Save Language Settings
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }

    // 2. View Flashcards
    const viewFlashcardsButton = document.getElementById('viewFlashcards');
    if (viewFlashcardsButton) {
        viewFlashcardsButton.addEventListener('click', handleViewFlashcardsClick);
    }
    
    // 3. Refresh Flashcards
    const refreshFlashcardsButton = document.getElementById('refreshFlashcards');
    if (refreshFlashcardsButton) {
        refreshFlashcardsButton.addEventListener('click', handleViewFlashcardsClick); // Refresh does the same as view
    }

    // 4. Delete a Flashcard (using Event Delegation)
    const flashcardList = document.getElementById('flashcardList');
    if (flashcardList) {
        flashcardList.addEventListener('click', (event) => {
            // Handle card flip
            const scene = event.target.closest('.flashcard-scene');
            if (scene && !event.target.matches('.delete-btn')) {
                scene.querySelector('.flashcard').classList.toggle('is-flipped');
            }

            // Handle delete button
            if (event.target.matches('.delete-btn')) {
                console.log("Delete button clicked");
                const cardId = event.target.dataset.cardId;
                deleteFlashcard(cardId);
            }
        });
    }

    // --- INITIALIZATION ---
    loadInitialState();
});

// --- CORE FUNCTIONS ---

/**
 * Loads language settings and flashcard count when the popup opens.
 */
async function loadInitialState() {
    try {
        // Load and set the target language
        const langResult = await chrome.storage.sync.get(['targetLanguage']);
        if (langResult.targetLanguage) {
            const targetLanguageElement = document.getElementById('targetLanguage');
            if (targetLanguageElement) {
                targetLanguageElement.value = langResult.targetLanguage;
            }
        }
        
        // Load flashcard count and update the button text
        const flashcards = await loadFlashcards();
        updateFlashcardButtonText(flashcards.length);

    } catch (error) {
        console.error('Error loading initial state:', error);
    }
}

/**
 * Saves the selected target language to storage and notifies the content script.
 */
async function saveSettings() {
    const targetLanguage = document.getElementById('targetLanguage')?.value || 'Japanese';
    try {
        await chrome.storage.sync.set({ targetLanguage: targetLanguage });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'updateSettings',
                targetLanguage: targetLanguage
            }).catch(err => console.log('Content script not ready yet.'));
        }
        showStatus('Language saved successfully!', 'success');
        setTimeout(() => window.close(), 1500);
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving language', 'error');
    }
}

/**
 * Fetches flashcards from storage and calls the display function.
 */
async function handleViewFlashcardsClick() {
    try {
        const flashcards = await loadFlashcards();
        displayFlashcards(flashcards);
    } catch (error) {
        console.error('Error handling view flashcards click:', error);
        showStatus('Error loading flashcards', 'error');
    }
}

/**
 * Renders the list of flashcards in the popup's HTML.
 * @param {Array} flashcards - The array of flashcard objects.
 */
function displayFlashcards(flashcards) {
    const container = document.getElementById('flashcardContainer');
    const list = document.getElementById('flashcardList');
    if (!container || !list) return;

    list.innerHTML = ''; // Clear previous content
    
    if (flashcards.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center;">No flashcards saved.</p>';
    } else {
        flashcards.forEach((card) => {
            const sceneElement = document.createElement('div');
            sceneElement.className = 'flashcard-scene';

            const cardElement = document.createElement('div');
            cardElement.className = 'flashcard';

            // Front Face (Original Word)
            const frontFace = document.createElement('div');
            frontFace.className = 'flashcard-face flashcard-face-front';
            frontFace.innerHTML = `
                <div class="flashcard-original">${card.original}</div>
                <div class="flashcard-meta">
                    <span>Lang: ${card.targetLanguage}</span>
                    <button class="delete-btn" data-card-id="${card.id}">Delete</button>
                </div>
            `;

            // Back Face (Translation)
            const backFace = document.createElement('div');
            backFace.className = 'flashcard-face flashcard-face-back';
            backFace.innerHTML = `
                <div class="flashcard-translation">${card.translation}</div>
                <div class="flashcard-meta">
                    <span>Lang: ${card.targetLanguage}</span>
                    <button class="delete-btn" data-card-id="${card.id}">Delete</button>
                </div>
            `;

            cardElement.appendChild(frontFace);
            cardElement.appendChild(backFace);
            sceneElement.appendChild(cardElement);
            list.appendChild(sceneElement);
        });
    }
    
    container.style.display = 'block';
}

/**
 * Deletes a specific flashcard from storage and updates the view.
 * @param {string} flashcardId - The ID of the flashcard to delete.
 */
async function deleteFlashcard(flashcardId) {
    try {
        // Test #1: Check the inputs
        console.log("Attempting to delete flashcard with ID:", flashcardId, `(Type: ${typeof flashcardId})`);

        let flashcards = await loadFlashcards();
        console.log("Flashcards before deletion:", flashcards);
        console.log("ID of first card in storage:", flashcards[0].id, `(Type: ${typeof flashcards[0].id})`);

        // The Filter Operation
        const filtered = flashcards.filter(card => String(card.id) !== String(flashcardId));
        
        // Test #2 & #3: Check the results
        console.log("Flashcards after deletion:", filtered);

        if (filtered.length === flashcards.length - 1) {
            console.log("✅ SUCCESS: The number of flashcards was reduced by one.");
        } else {
            console.error("❌ FAILURE: The flashcard was not removed from the array.");
        }

        await chrome.storage.sync.set({ flashcards: filtered });
        
        displayFlashcards(filtered);
        updateFlashcardButtonText(filtered.length);
        showStatus('Flashcard deleted!', 'success');
    } catch (error) {
        console.error('Error deleting flashcard:', error);
        showStatus('Error deleting flashcard', 'error');
    }
}

/**
 * Retrieves the flashcards array from Chrome's sync storage.
 * @returns {Promise<Array>} A promise that resolves to the array of flashcards.
 */
async function loadFlashcards() {
    try {
        const result = await chrome.storage.sync.get(['flashcards']);
        // --- DEBUG LOG ---
        console.log('POPUP: Attempting to load. Data received from storage:', result);
        return result.flashcards || [];
    } catch (error) {
        console.error('Error loading flashcards:', error);
        return [];
    }
}

// --- UTILITY FUNCTIONS ---

/**
 * Updates the text on the 'View My Flashcards' button with the current count.
 * @param {number} count - The number of flashcards.
 */
function updateFlashcardButtonText(count) {
    const viewFlashcardsButton = document.getElementById('viewFlashcards');
    if (viewFlashcardsButton) {
        viewFlashcardsButton.textContent = count > 0 ? `View My Flashcards (${count})` : 'View My Flashcards';
    }
}
 
/**
 * Shows a status message (e.g., success or error) in the popup.
 * @param {string} message - The text to display.
 * @param {'success'|'error'} type - The type of message.
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
    }
}

// Listen for messages from other parts of the extension (e.g., content script)
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'flashcardSaved') {
        updateFlashcardButtonText(message.totalCount);
    }
});