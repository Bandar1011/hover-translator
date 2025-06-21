// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
      // Check if chrome.storage is available
      if (chrome && chrome.storage && chrome.storage.sync) {
          const result = await chrome.storage.sync.get(['targetLanguage']);
          
          if (result.targetLanguage) {
              const targetLanguageElement = document.getElementById('targetLanguage');
              if (targetLanguageElement) {
                  targetLanguageElement.value = result.targetLanguage;
              }
          }
      }
  } catch (error) {
      console.error('Error loading settings:', error);
  }
});

// Save settings when button is clicked
document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('saveSettings');
  if (saveButton) {
      saveButton.addEventListener('click', async () => {
          const targetLanguage = document.getElementById('targetLanguage')?.value || 'Japanese';
          
          try {
              // Check if chrome.storage is available
              if (chrome && chrome.storage && chrome.storage.sync) {
                  // Save to storage
                  await chrome.storage.sync.set({
                      targetLanguage: targetLanguage
                  });
                  
                  // Send message to content script to update settings
                  if (chrome.tabs) {
                      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                      
                      try {
                          await chrome.tabs.sendMessage(tab.id, {
                              action: 'updateSettings',
                              targetLanguage: targetLanguage
                          });
                      } catch (error) {
                          // Content script might not be loaded yet, that's okay
                          console.log('Content script not ready yet');
                      }
                  }
              }
              
              showStatus('Language saved successfully!', 'success');
              
              // Close popup after a short delay
              setTimeout(() => {
                  window.close();
              }, 1500);
              
          } catch (error) {
              console.error('Error saving settings:', error);
              showStatus('Error saving language', 'error');
          }
      });
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
      statusDiv.style.display = 'block';
  }
}