interface Message {
	action: string;
	payload?: any;
}

chrome.runtime.onMessage.addListener((message: Message, _, sendResponse) => {
	console.log("Background script received message:", message);
	if (message.action === "summon") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]?.id) {
				console.log("Injecting content script into tab:", tabs[0].id);
				chrome.scripting
					.executeScript({
						target: { tabId: tabs[0].id },
						files: ["content.js"],
					})
					.then(() => {
						console.log("Content script injected");
						sendResponse({ status: "Content script executed" });
					})
					.catch((error) => {
						console.error("Error injecting content script:", error);
						sendResponse({ status: "error", error: error.message });
					});
			}
		});
		return true;
	}
	return false;
});
