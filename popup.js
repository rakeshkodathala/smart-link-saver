document.addEventListener('DOMContentLoaded', function () {
  // Safely get DOM elements with error handling
  function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with id '${id}' not found`);
      return null;
    }
    return element;
  }

  // Initialize DOM elements with null checks
  const savedLinksContainer = getElement('savedLinks');
  const clearAllButton = getElement('clearAll');
  const exportLinksButton = getElement('exportLinks');
  const searchInput = getElement('searchInput');
  const filterButtons = document.querySelectorAll('.filter-button');
  const themeToggle = getElement('themeToggle');

  // Early return if critical elements are missing
  if (!savedLinksContainer) {
    console.error('Critical element savedLinksContainer not found');
    return;
  }

  let currentFilter = 'all';
  let searchTerm = '';
  let allItems = [];
  let isLoading = false;

  // Theme handling with error checking
  function setTheme(isDark) {
    try {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      if (themeToggle) {
        themeToggle.checked = isDark;
      }
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }

  // Load saved theme with error handling
  if (themeToggle) {
    chrome.storage.local.get(['darkMode'], function (result) {
      try {
        setTheme(result.darkMode);
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    });

    // Theme toggle handler
    themeToggle.addEventListener('change', function () {
      try {
        const isDark = this.checked;
        setTheme(isDark);
        chrome.storage.local.set({ darkMode: isDark });
      } catch (error) {
        console.error('Error handling theme toggle:', error);
      }
    });
  }

  // Show loading state with error handling
  function showLoading() {
    try {
      if (!isLoading) {
        isLoading = true;
        savedLinksContainer.innerHTML = `
          <div class="skeleton skeleton-item"></div>
          <div class="skeleton skeleton-item"></div>
          <div class="skeleton skeleton-item"></div>
        `;
      }
    } catch (error) {
      console.error('Error showing loading state:', error);
    }
  }

  // Load and display saved links with error handling
  function loadSavedLinks() {
    try {
      showLoading();
      chrome.storage.local.get(['savedLinks'], function (result) {
        try {
          allItems = result.savedLinks || [];
          filterAndDisplayItems();
        } catch (error) {
          console.error('Error processing saved links:', error);
          savedLinksContainer.innerHTML = '<div class="empty-message">Error loading items. Please try again.</div>';
        } finally {
          isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error loading saved links:', error);
      isLoading = false;
    }
  }

  // Highlight text with error handling
  function highlightText(text = '', searchTerm = '') {
    try {
      if (!searchTerm) return text;
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    } catch (error) {
      console.error('Error highlighting text:', error);
      return text;
    }
  }

  // Format date with error handling
  function formatDate(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  // Filter and display items with error handling
  function filterAndDisplayItems() {
    try {
      if (!savedLinksContainer) return;
      savedLinksContainer.innerHTML = '';

      if (!Array.isArray(allItems) || allItems.length === 0) {
        savedLinksContainer.innerHTML = '<div class="empty-message">No saved links or search queries yet.</div>';
        return;
      }

      let filteredItems = allItems
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .filter(item => {
          if (!item) return false;
          if (currentFilter !== 'all' && item.type !== currentFilter) return false;
          if (!searchTerm) return true;

          const searchLower = searchTerm.toLowerCase();
          const itemType = item.type || 'link';

          if (itemType === 'search') {
            return (item.query || '').toLowerCase().includes(searchLower) ||
              (item.url || '').toLowerCase().includes(searchLower);
          }
          return (item.title || '').toLowerCase().includes(searchLower) ||
            (item.url || '').toLowerCase().includes(searchLower);
        });

      if (filteredItems.length === 0) {
        savedLinksContainer.innerHTML = '<div class="empty-message">No items match your search.</div>';
        return;
      }

      filteredItems.forEach((item, index) => {
        try {
          const itemElement = document.createElement('div');
          itemElement.className = 'link-item';
          itemElement.setAttribute('data-type', item.type || 'link');
          itemElement.style.animationDelay = `${index * 0.1}s`;

          const contentElement = document.createElement('div');
          contentElement.className = 'link-content';

          const title = item.type === 'search' ? `Search: ${item.query || ''}` : (item.title || 'Untitled');
          const url = item.url || '#';

          contentElement.innerHTML = `
            <div class="link-title">${highlightText(title, searchTerm)}</div>
            <div class="link-url">${highlightText(url, searchTerm)}</div>
            <div class="link-timestamp">${formatDate(item.timestamp)}</div>
          `;

          if (url !== '#') {
            contentElement.addEventListener('click', () => {
              try {
                window.open(url, '_blank');
              } catch (error) {
                console.error('Error opening URL:', error);
              }
            });
          }

          const buttonGroup = document.createElement('div');
          buttonGroup.className = 'button-group';

          const copyButton = document.createElement('button');
          copyButton.className = 'copy-button';
          copyButton.textContent = 'Copy';
          copyButton.setAttribute('data-tooltip', 'Copy URL to clipboard');

          copyButton.addEventListener('click', async (e) => {
            try {
              e.stopPropagation();
              await navigator.clipboard.writeText(url);
              copyButton.textContent = 'Copied!';
              copyButton.classList.add('success');
              setTimeout(() => {
                copyButton.textContent = 'Copy';
                copyButton.classList.remove('success');
              }, 2000);
            } catch (error) {
              console.error('Error copying to clipboard:', error);
              copyButton.textContent = 'Error';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            }
          });

          const deleteButton = document.createElement('button');
          deleteButton.className = 'delete-button';
          deleteButton.textContent = 'Delete';
          deleteButton.setAttribute('data-tooltip', 'Remove this item');

          deleteButton.addEventListener('click', (e) => {
            try {
              e.stopPropagation();
              itemElement.classList.add('removing');
              setTimeout(() => {
                const updatedItems = allItems.filter(i => i.url !== item.url);
                chrome.storage.local.set({ savedLinks: updatedItems }, () => {
                  allItems = updatedItems;
                  filterAndDisplayItems();
                });
              }, 300);
            } catch (error) {
              console.error('Error deleting item:', error);
            }
          });

          buttonGroup.appendChild(copyButton);
          buttonGroup.appendChild(deleteButton);
          itemElement.appendChild(contentElement);
          itemElement.appendChild(buttonGroup);
          savedLinksContainer.appendChild(itemElement);
        } catch (error) {
          console.error('Error creating item element:', error);
        }
      });
    } catch (error) {
      console.error('Error filtering and displaying items:', error);
      savedLinksContainer.innerHTML = '<div class="empty-message">Error displaying items. Please try again.</div>';
    }
  }

  // Set up event listeners with error handling
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      try {
        searchTerm = e.target.value;
        filterAndDisplayItems();
      } catch (error) {
        console.error('Error handling search:', error);
      }
    });
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      try {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.getAttribute('data-filter');
        filterAndDisplayItems();
      } catch (error) {
        console.error('Error handling filter:', error);
      }
    });
  });

  if (clearAllButton) {
    clearAllButton.addEventListener('click', function () {
      try {
        if (confirm('Are you sure you want to clear all saved items?')) {
          clearAllButton.classList.add('loading');
          chrome.storage.local.set({ savedLinks: [] }, function () {
            allItems = [];
            filterAndDisplayItems();
            clearAllButton.classList.remove('loading');
          });
        }
      } catch (error) {
        console.error('Error clearing items:', error);
        clearAllButton.classList.remove('loading');
      }
    });
  }

  // Function to export links as Excel
  async function exportAsExcel() {
    try {
      // Show loading state
      if (exportLinksButton) {
        exportLinksButton.classList.add('loading');
      }

      // Get the latest data directly from storage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['savedLinks'], (result) => {
          resolve(result);
        });
      });

      const links = result.savedLinks || [];
      console.log('Exporting links:', links); // Debug log

      if (links.length === 0) {
        showError('No links to export');
        return;
      }

      // Create CSV content with BOM for Excel
      let csvContent = "\ufeff"; // Add BOM for Excel
      csvContent += "Title,URL,Type,Date\n";

      // Add data rows with proper escaping
      links.forEach(link => {
        const title = (link.title || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const url = (link.url || '').replace(/"/g, '""');
        const type = link.type || 'link';
        const date = new Date(link.timestamp).toLocaleString();

        csvContent += `"${title}","${url}","${type}","${date}"\n`;
      });

      // Create blob with proper encoding
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // Create and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `saved-links-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      // Show success message
      showSuccess(`Successfully exported ${links.length} links!`);
    } catch (error) {
      console.error('Error exporting links:', error);
      showError('Failed to export links. Please try again.');
    } finally {
      // Remove loading state
      if (exportLinksButton) {
        exportLinksButton.classList.remove('loading');
      }
    }
  }

  // Add export button event listener
  if (exportLinksButton) {
    exportLinksButton.addEventListener('click', () => {
      // Force refresh data before export
      chrome.storage.local.get(['savedLinks'], (result) => {
        allItems = result.savedLinks || [];
        exportAsExcel();
      });
    });
  }

  // Initial load
  loadSavedLinks();
});
