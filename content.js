console.log("✅ Content script is running");

// Store the last copied text to prevent duplicates
let lastCopiedText = "";
let urlChangeObserver = null;
let buttonContainer = null;

// Function to save the current URL
function saveCurrentUrl() {
  chrome.runtime.sendMessage({
    action: 'saveLink',
    url: window.location.href,
    title: document.title
  });
}

// Listen for keyboard shortcuts
let keyboardListener = async function (e) {
  // Check for Ctrl+C or Cmd+C
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    // Small delay to ensure the copy operation is complete
    setTimeout(async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        console.log('Clipboard content:', clipboardText);

        // Check if the clipboard content matches the current URL
        if (clipboardText === window.location.href) {
          console.log('URL copied from address bar');
          saveCurrentUrl();
          return;
        }

        // If it's not the current URL, check if it's any valid URL
        if (isValidUrl(clipboardText) && clipboardText !== lastCopiedText) {
          console.log('Valid URL copied:', clipboardText);
          chrome.runtime.sendMessage({
            action: 'saveLink',
            url: clipboardText,
            title: document.title
          });
          lastCopiedText = clipboardText;
          return;
        }

        // Check if we're on Google search and copying from search bar
        if (window.location.hostname.includes('google.com') &&
          document.activeElement.name === 'q') {
          console.log('Search query copied:', clipboardText);
          chrome.runtime.sendMessage({
            action: 'saveSearch',
            query: clipboardText,
            url: window.location.href
          });
          lastCopiedText = clipboardText;
        }
      } catch (err) {
        console.error('Failed to read clipboard:', err);
      }
    }, 100);
  }
};

// Detect search queries on page load
function detectSearchQueries() {
  if (window.location.hostname.includes('google.com')) {
    const searchInput = document.querySelector('input[name="q"]');
    if (searchInput && searchInput.value) {
      console.log('Detected Google search query:', searchInput.value);
      chrome.runtime.sendMessage({
        action: 'saveSearch',
        query: searchInput.value,
        url: window.location.href
      });
    }
  }
}

// Function to validate URL
function isValidUrl(string) {
  try {
    if (typeof string !== 'string') return false;
    if (!string.match(/^https?:\/\//i) && !string.match(/^www\./i)) {
      return false;
    }
    new URL(string.startsWith('www.') ? 'https://' + string : string);
    return true;
  } catch (_) {
    return false;
  }
}

// Function to create save button
function createSaveButton() {
  try {
    // Remove any existing button first
    const existingButton = document.getElementById('smart-link-saver-button');
    if (existingButton) {
      existingButton.remove();
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'smart-link-saver-button';

    // Apply styles directly to avoid CSP issues
    buttonContainer.style.cssText = `
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2147483647;
      transition: top 0.3s ease;
      cursor: move;
      pointer-events: auto;
      visibility: visible;
      opacity: 1;
    `;

    // Create button element
    const button = document.createElement('button');
    button.textContent = 'Save URL';

    // Apply button styles
    button.style.cssText = `
      background-color: #4a90e2;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      display: block;
      pointer-events: auto;
      visibility: visible;
      opacity: 1;
    `;

    // Add hover effect
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#357abd';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    });

    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#4a90e2';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    });

    // Add click handler
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const currentUrl = window.location.href;
        const title = document.title;

        // Get existing links
        const result = await chrome.storage.local.get(['savedLinks']);
        const savedLinks = result.savedLinks || [];

        // Check if URL already exists
        if (savedLinks.some(link => link.url === currentUrl)) {
          button.textContent = 'Already Saved';
          button.style.backgroundColor = '#4CAF50';
          setTimeout(() => {
            button.textContent = 'Save URL';
            button.style.backgroundColor = '#4a90e2';
          }, 2000);
          return;
        }

        // Add new link
        savedLinks.push({
          url: currentUrl,
          title: title,
          timestamp: new Date().toISOString(),
          type: 'link'
        });

        // Save to storage
        await chrome.storage.local.set({ savedLinks });

        // Show success state
        button.textContent = 'Saved!';
        button.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
          button.textContent = 'Save URL';
          button.style.backgroundColor = '#4a90e2';
        }, 2000);
      } catch (error) {
        console.error('Error saving URL:', error);
        button.textContent = 'Error';
        button.style.backgroundColor = '#dc3545';
        setTimeout(() => {
          button.textContent = 'Save URL';
          button.style.backgroundColor = '#4a90e2';
        }, 2000);
      }
    });

    // Add drag functionality
    let isDragging = false;
    let startY;
    let startTop;

    buttonContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      startTop = parseInt(buttonContainer.style.top) || 50;
      buttonContainer.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaY = e.clientY - startY;
      const newTop = startTop + (deltaY / window.innerHeight * 100);

      // Limit the movement within the viewport
      const limitedTop = Math.max(5, Math.min(95, newTop));
      buttonContainer.style.top = `${limitedTop}%`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      buttonContainer.style.transition = 'top 0.3s ease';
    });

    // Append button to container
    buttonContainer.appendChild(button);

    // Return the container instead of appending directly
    return buttonContainer;
  } catch (error) {
    console.error('Error creating save button:', error);
    return null;
  }
}

// Function to append button to page
function appendButtonToPage() {
  try {
    // Don't proceed if document or body is not available
    if (!document || !document.body) {
      console.log("Document or body not available for button append");
      return;
    }

    // Create new button if it doesn't exist
    if (!buttonContainer) {
      buttonContainer = createSaveButton();
    }

    if (!buttonContainer) {
      console.error("Failed to create save button");
      return;
    }

    // Remove existing button if present
    const existingButton = document.getElementById('smart-link-saver-button');
    if (existingButton) {
      existingButton.remove();
    }

    // Append the button
    document.body.appendChild(buttonContainer);
    console.log("Save button container added to page");

  } catch (error) {
    console.error("Error in appendButtonToPage:", error);
  }
}

// Initialize the extension
function initializeExtension() {
  try {
    // Early return if document or body is not available
    if (!document || !document.body) {
      console.log("Document or body not available yet, will retry...");
      setTimeout(initializeExtension, 500);
      return;
    }

    // Check if we're in an iframe
    if (window !== window.top) {
      console.log("In iframe, skipping initialization");
      return;
    }

    console.log("Initializing extension...");

    // Clean up existing elements and observers
    cleanup();

    // Append button to page
    appendButtonToPage();

    // Setup URL change detection
    setupUrlChangeDetection();
  } catch (error) {
    console.error("Error in initializeExtension:", error);
  }
}

// Separate LinkedIn handling logic
function handleLinkedIn() {
  try {
    // Wait for LinkedIn's JS to initialize
    setTimeout(() => {
      // Try to find a stable container
      const container = findLinkedInContainer();
      if (container) {
        console.log("LinkedIn container found, adding button");
        appendButtonToPage();
        observeLinkedInChanges(container);
      } else {
        console.log("No LinkedIn container found, retrying...");
        handleLinkedIn(); // Retry
      }
    }, 1000);
  } catch (error) {
    console.error("Error in handleLinkedIn:", error);
  }
}

// Find a stable container in LinkedIn
function findLinkedInContainer() {
  const selectors = [
    '#global-nav',
    '#main',
    '.application-outlet',
    '#profile-content',
    '.feed-container',
    'body'
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    } catch (e) {
      console.warn(`Error finding selector ${selector}:`, e);
    }
  }
  return null;
}

// Observe LinkedIn page changes
function observeLinkedInChanges(container) {
  try {
    if (!container) return;

    // Disconnect any existing observers
    if (window.linkedInObserver) {
      window.linkedInObserver.disconnect();
    }

    // Create new observer
    window.linkedInObserver = new MutationObserver((mutations) => {
      if (!document.getElementById('smart-link-saver-container')) {
        console.log("LinkedIn content changed, re-adding button");
        appendButtonToPage();
      }
    });

    // Start observing
    window.linkedInObserver.observe(container, {
      childList: true,
      subtree: true
    });

  } catch (error) {
    console.error("Error in observeLinkedInChanges:", error);
  }
}

// Helper function to wait for an element
function waitForElement(selector, callback, maxAttempts = 10) {
  let attempts = 0;
  const checkElement = () => {
    attempts++;
    const element = document.querySelector(selector);
    if (element) {
      callback();
    } else if (attempts < maxAttempts) {
      setTimeout(checkElement, 500);
    } else {
      console.log(`Failed to find ${selector} after ${maxAttempts} attempts`);
    }
  };
  checkElement();
}

// Clean up function
function cleanup() {
  try {
    // Remove existing button
    const existingButton = document.getElementById('smart-link-saver-container');
    if (existingButton) {
      existingButton.remove();
    }

    // Clean up observers
    if (window.linkedInObserver) {
      window.linkedInObserver.disconnect();
      window.linkedInObserver = null;
    }

    // Remove event listeners
    if (window.keyboardListener) {
      document.removeEventListener('keydown', window.keyboardListener);
    }

    // Clean up storage listeners
    if (chrome.storage && chrome.storage.onChanged && window.storageListener) {
      chrome.storage.onChanged.removeListener(window.storageListener);
    }

  } catch (error) {
    console.error("Error in cleanup:", error);
  }
}

// Setup URL change detection
function setupUrlChangeDetection() {
  let lastUrl = window.location.href;

  // Create new observer for URL changes
  urlChangeObserver = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      console.log("URL changed, updating button state...");
      if (buttonContainer) {
        const updateButton = buttonContainer.querySelector('#smart-link-saver-button');
        if (updateButton && updateButton.updateButtonState) {
          updateButton.updateButtonState();
        }
      }
      detectSearchQueries();
    }
  });

  urlChangeObserver.observe(document.documentElement, {
    subtree: true,
    childList: true
  });
}

// Ensure proper initialization timing
function setupInitialization() {
  try {
    // Initial load
    if (document.readyState === 'complete') {
      initializeExtension();
    } else {
      window.addEventListener('load', initializeExtension);
    }

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        initializeExtension();
      }
    });

    // Handle navigation
    window.addEventListener('popstate', () => {
      setTimeout(initializeExtension, 500);
    });

    // Multiple initialization attempts
    [1000, 2000, 3000, 5000].forEach(delay => {
      setTimeout(() => {
        if (!document.getElementById('smart-link-saver-container')) {
          initializeExtension();
        }
      }, delay);
    });

  } catch (error) {
    console.error("Error in setupInitialization:", error);
  }
}

// Start the initialization process
setupInitialization();

// Add keyboard listener
document.addEventListener('keydown', keyboardListener);
