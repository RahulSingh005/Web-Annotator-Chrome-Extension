chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  chrome.contextMenus.create({
    id: 'annotate',
    title: 'Annotate This Page',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener((clickData) => {
  if (clickData.menuItemId === "annotate") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_ANNOTATION') {
    saveAnnotation(message.annotation, message.url)
      .then(() => sendResponse({ status: 'success' }))
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  } else if (message.type === 'GET_ANNOTATIONS') {
    getAnnotations(message.url)
      .then(annotations => sendResponse({ status: 'success', annotations }))
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
});

const saveAnnotation = (annotation, url) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ annotations: {} }, (result) => {
      const annotations = result.annotations;
      if (!annotations[url]) annotations[url] = [];
      annotations[url].push(annotation);
      chrome.storage.local.set({ annotations }, () => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
      });
    });
  });
};

const getAnnotations = (url) => {
  return new Promise((resolve) => {
    chrome.storage.local.get({ annotations: {} }, (result) => {
      resolve(result.annotations[url] || []);
    });
  });
};
