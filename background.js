console.log("✅ Background script is running");

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, creating context menu");
  chrome.contextMenus.create({
    id: "saveLink",
    title: "Save Link",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "saveCurrentUrl",
    title: "Save Current URL",
    contexts: ["page"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info);
  if (info.menuItemId === "saveLink") {
    console.log("Saving link from context menu:", info.linkUrl);
    saveLink(info.linkUrl, tab.title);
  } else if (info.menuItemId === "saveCurrentUrl") {
    console.log("Saving current URL:", tab.url);
    saveLink(tab.url, tab.title);
  }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "save_current_url") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        saveLink(tabs[0].url, tabs[0].title);
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "saveLink") {
    console.log("Saving link from content script:", request.url);
    saveLink(request.url, request.title);
    sendResponse({ success: true });
  } else if (request.action === "saveSearch") {
    console.log("Saving search query from content script:", request.query);
    saveSearchQuery(request.query, request.url);
    sendResponse({ success: true });
  } else if (request.action === "saveCurrentUrl") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        saveLink(tabs[0].url, tabs[0].title);
      }
    });
    sendResponse({ success: true });
  }
  return true;
});

// Listen for navigation events to detect search queries
chrome.webNavigation.onCompleted.addListener((details) => {
  // Check if this is a search engine result page
  const searchEngines = {
    'google.com': /[?&]q=([^&]+)/,
    'bing.com': /[?&]q=([^&]+)/,
    'yahoo.com': /[?&]p=([^&]+)/,
    'duckduckgo.com': /[?&]q=([^&]+)/
  };

  const url = new URL(details.url);
  const hostname = url.hostname;

  // Check if this is a known search engine
  for (const [engine, regex] of Object.entries(searchEngines)) {
    if (hostname.includes(engine)) {
      const match = url.search.match(regex);
      if (match && match[1]) {
        const query = decodeURIComponent(match[1]);
        console.log(`Detected search query on ${engine}:`, query);
        saveSearchQuery(query, details.url);
      }
      break;
    }
  }
});

// Function to save link
function saveLink(url, title) {
  console.log("Saving link:", url, "with title:", title);
  chrome.storage.local.get(['savedLinks'], function (result) {
    const links = result.savedLinks || [];

    // Check if link already exists
    const linkExists = links.some(link => link.url === url);
    if (!linkExists) {
      links.push({
        url: url,
        title: title || url,
        timestamp: new Date().toISOString(),
        type: 'link'
      });

      chrome.storage.local.set({ savedLinks: links }, function () {
        console.log("Link saved successfully");
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Link Saved',
          message: 'Link has been saved successfully!'
        });
      });
    } else {
      console.log("Link already exists, not saving duplicate");
    }
  });
}

// Function to save search query
function saveSearchQuery(query, url) {
  console.log("Saving search query:", query, "from URL:", url);
  chrome.storage.local.get(['savedLinks'], function (result) {
    const links = result.savedLinks || [];

    // Check if search query already exists
    const queryExists = links.some(link =>
      link.type === 'search' && link.query === query
    );

    if (!queryExists) {
      links.push({
        query: query,
        url: url,
        timestamp: new Date().toISOString(),
        type: 'search'
      });

      chrome.storage.local.set({ savedLinks: links }, function () {
        console.log("Search query saved successfully");
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Search Query Saved',
          message: `"${query}" has been saved successfully!`
        });
      });
    } else {
      console.log("Search query already exists, not saving duplicate");
    }
  });
}
