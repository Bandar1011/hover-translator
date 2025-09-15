// Global state
let currentDeck = null;
let studyCards = [];
let currentCardIndex = 0;
let roundNumber = 1;
let totalCards = 0;
let knownCards = 0;

document.addEventListener('DOMContentLoaded', () => {
    // --- EVENT LISTENERS ---

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show/hide appropriate content
            const tabName = button.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(tabName + 'Tab').style.display = 'block';
            
            // Hide study container when switching tabs
            document.getElementById('studyContainer').style.display = 'none';
        });
    });

    // Create new deck
    document.getElementById('createDeck').addEventListener('click', async () => {
        const deckName = prompt('Enter deck name:');
        if (deckName) {
            await createDeck(deckName);
            await loadDecks();
            updateDeckSelect();
        }
    });

    // Add flashcard form
    document.getElementById('addFlashcard').addEventListener('click', async () => {
        const deckId = document.getElementById('selectDeck').value;
        const frontText = document.getElementById('frontText').value.trim();
        const backText = document.getElementById('backText').value.trim();
        const hiragana = document.getElementById('hiragana').value.trim();

        if (!deckId || !frontText || !backText) {
            showStatus('Please fill in all required fields', 'error');
            return;
        }

        await addFlashcard(deckId, frontText, backText, hiragana);
        
        // Clear form
        document.getElementById('frontText').value = '';
        document.getElementById('backText').value = '';
        document.getElementById('hiragana').value = '';
        
        showStatus('Flashcard added successfully!', 'success');
        await loadDecks(); // Refresh deck list to update counts
    });

    // Study mode controls
    document.getElementById('flipCard').addEventListener('click', () => {
        const frontContent = document.getElementById('cardFront');
        const backContent = document.getElementById('cardBack');
        if (frontContent.style.display !== 'none') {
            frontContent.style.display = 'none';
            backContent.style.display = 'block';
        } else {
            frontContent.style.display = 'block';
            backContent.style.display = 'none';
        }
    });

    document.getElementById('knowBtn').addEventListener('click', () => {
        if (currentCardIndex < studyCards.length - 1) {
            studyCards[currentCardIndex].known = true;
            currentCardIndex++;
            showCurrentCard();
        } else {
            finishStudySession();
        }
    });

    document.getElementById('dontKnowBtn').addEventListener('click', () => {
        if (currentCardIndex < studyCards.length - 1) {
            currentCardIndex++;
            showCurrentCard();
        } else {
            finishStudySession();
        }
    });

    document.getElementById('finishStudy').addEventListener('click', finishStudySession);

    // Language settings
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }

    // --- INITIALIZATION ---
    loadInitialState();
});

// --- DECK MANAGEMENT FUNCTIONS ---

async function createDeck(name) {
    try {
        const result = await chrome.storage.sync.get(['decks']);
        const decks = result.decks || [];
        const newDeck = {
            id: String(Date.now()),
            name: name,
            cards: []
        };
        decks.push(newDeck);
        await chrome.storage.sync.set({ decks: decks });
        showStatus('Deck created successfully!', 'success');
    } catch (error) {
        console.error('Error creating deck:', error);
        showStatus('Error creating deck', 'error');
    }
}

async function addFlashcard(deckId, original, translation, hiragana = '') {
    try {
        const result = await chrome.storage.sync.get(['decks']);
        const decks = result.decks || [];
        const deckIndex = decks.findIndex(d => d.id === deckId);
        
        if (deckIndex === -1) {
            throw new Error('Deck not found');
        }

        const newCard = {
            id: String(Date.now()),
            original: original,
            translation: translation,
            hiragana: hiragana,
            createdAt: new Date().toISOString(),
            known: false,
            reviewCount: 0
        };

        decks[deckIndex].cards.push(newCard);
        await chrome.storage.sync.set({ decks: decks });
    } catch (error) {
        console.error('Error adding flashcard:', error);
        showStatus('Error adding flashcard', 'error');
    }
}

async function loadDecks() {
    try {
        const result = await chrome.storage.sync.get(['decks']);
        const decks = result.decks || [];
        
        // If no decks exist, create the default deck
        if (decks.length === 0) {
            const defaultDeck = {
                id: 'deck1',
                name: 'Deck 1',
                cards: []
            };
            decks.push(defaultDeck);
            await chrome.storage.sync.set({ decks: decks });
        }

        // Migrate any old flashcards to Deck 1
        const oldFlashcards = await loadOldFlashcards();
        if (oldFlashcards.length > 0) {
            decks[0].cards.push(...oldFlashcards);
            await chrome.storage.sync.set({ decks: decks });
            // Clear old storage
            await chrome.storage.sync.remove(['flashcards']);
        }

        const deckList = document.getElementById('deckList');
        deckList.innerHTML = '';

        decks.forEach(deck => {
            const deckElement = document.createElement('div');
            deckElement.className = 'deck-item';
            deckElement.innerHTML = `
                <span class="deck-name">${deck.name}</span>
                <span class="deck-count">${deck.cards.length} cards</span>
                <button class="study-btn" data-deck-id="${deck.id}">Study</button>
            `;
            deckList.appendChild(deckElement);

            // Add click handler for study button
            const studyBtn = deckElement.querySelector('.study-btn');
            studyBtn.addEventListener('click', () => startStudySession(deck));
        });

        return decks;
    } catch (error) {
        console.error('Error loading decks:', error);
        showStatus('Error loading decks', 'error');
        return [];
    }
}

async function loadOldFlashcards() {
    try {
        const result = await chrome.storage.sync.get(['flashcards']);
        return result.flashcards || [];
    } catch (error) {
        console.error('Error loading old flashcards:', error);
        return [];
    }
}

async function updateDeckSelect() {
    const result = await chrome.storage.sync.get(['decks']);
    const decks = result.decks || [];
    
    const select = document.getElementById('selectDeck');
    select.innerHTML = '';
    
    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        select.appendChild(option);
    });
}

// --- STUDY MODE FUNCTIONS ---

function startStudySession(deck) {
    currentDeck = deck;
    // Reset study session
    studyCards = roundNumber === 1 ? [...deck.cards] : deck.cards.filter(card => !card.known);
    currentCardIndex = 0;
    totalCards = studyCards.length;
    knownCards = 0;
    
    // If all cards are known, reset the deck
    if (studyCards.length === 0) {
        roundNumber = 1;
        deck.cards.forEach(card => card.known = false);
        studyCards = [...deck.cards];
        totalCards = studyCards.length;
        showStatus('全てのカードを習得しました！新しいラウンドを開始します。', 'success');
    }
    
    // Hide other views and show study container
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    const studyContainer = document.getElementById('studyContainer');
    studyContainer.style.display = 'block';
    
    // Update deck name and round number
    document.getElementById('studyDeckName').textContent = `${deck.name} - ラウンド ${roundNumber}`;
    
    // Show first card
    showCurrentCard();
}

function showCurrentCard() {
    if (currentCardIndex >= studyCards.length) {
        finishStudySession();
        return;
    }

    const card = studyCards[currentCardIndex];
    const frontContent = document.getElementById('cardFront');
    const backContent = document.getElementById('cardBack');

    // Show front of card
    frontContent.innerHTML = `
        <div class="flashcard-original">${card.original}</div>
    `;
    
    // Prepare back of card
    let backHTML = `<div class="flashcard-translation">${card.translation}</div>`;
    if (card.hiragana) {
        backHTML += `<div class="hiragana-text">${card.hiragana}</div>`;
    }
    backContent.innerHTML = backHTML;

    // Reset card flip
    frontContent.style.display = 'block';
    backContent.style.display = 'none';

    // Update progress
    document.getElementById('progressText').textContent = 
        `Card ${currentCardIndex + 1} of ${studyCards.length}`;
}

async function finishStudySession() {
    try {
        const result = await chrome.storage.sync.get(['decks']);
        const decks = result.decks || [];
        const deckIndex = decks.findIndex(d => d.id === currentDeck.id);
        
        if (deckIndex !== -1) {
            studyCards.forEach(studyCard => {
                const cardIndex = decks[deckIndex].cards.findIndex(c => c.id === studyCard.id);
                if (cardIndex !== -1) {
                    decks[deckIndex].cards[cardIndex].known = studyCard.known;
                    decks[deckIndex].cards[cardIndex].reviewCount++;
                }
            });
            
            await chrome.storage.sync.set({ decks: decks });
        }

        // Calculate statistics
        const knownCount = studyCards.filter(card => card.known).length;
        const percentage = Math.round((knownCount / totalCards) * 100);
        const unknownCount = totalCards - knownCount;
        
        // Update results modal
        const modal = document.getElementById('resultsModal');
        document.getElementById('successRate').textContent = `${percentage}%`;
        document.getElementById('knownCount').textContent = knownCount;
        document.getElementById('unknownCount').textContent = unknownCount;
        document.getElementById('progressFill').style.width = `${percentage}%`;
        
        // Show/hide appropriate buttons
        const continueBtn = document.getElementById('continueStudy');
        if (unknownCount > 0) {
            continueBtn.style.display = 'block';
            continueBtn.textContent = `Continue Round ${roundNumber + 1}`;
        } else {
            continueBtn.style.display = 'none';
        }
        
        // Hide study container and show modal
        document.getElementById('studyContainer').style.display = 'none';
        modal.style.display = 'block';
        
        // Add event listeners for modal buttons
        document.getElementById('continueStudy').onclick = () => {
            modal.style.display = 'none';
            roundNumber++;
            startStudySession(currentDeck);
        };
        
        document.getElementById('finishStudySession').onclick = async () => {
            modal.style.display = 'none';
            document.getElementById('decksTab').style.display = 'block';
            if (unknownCount === 0) {
                roundNumber = 1;
                currentDeck.cards.forEach(card => card.known = false);
            }
            await loadDecks();
        };
        
    } catch (error) {
        console.error('Error saving study session:', error);
        showStatus('Error saving progress', 'error');
    }
}

// --- UTILITY FUNCTIONS ---

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.innerHTML = message.replace(/\n/g, '<br>');
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // For study session results, show the message longer
        const isStudyResult = message.includes('ラウンド') && message.includes('正解率');
        const timeout = isStudyResult ? 5000 : 2000;
        
        setTimeout(() => { statusDiv.style.display = 'none'; }, timeout);
    }
}

// --- INITIALIZATION ---

async function loadInitialState() {
    try {
        // Load language setting
        const langResult = await chrome.storage.sync.get(['targetLanguage']);
        if (langResult.targetLanguage) {
            const targetLanguageElement = document.getElementById('targetLanguage');
            if (targetLanguageElement) {
                targetLanguageElement.value = langResult.targetLanguage;
            }
        }
        
        // Load decks and update UI
        await loadDecks();
        await updateDeckSelect();
    } catch (error) {
        console.error('Error loading initial state:', error);
    }
}

// --- SETTINGS ---

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
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving language', 'error');
    }
}