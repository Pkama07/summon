// a content script to execute the actions provided by the LLM

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "execute" && message.args?.actions) {
		const { actions, xpathMap } = message.args;
		const done = executeActions(actions, xpathMap);
		sendResponse({ done });
		return true;
	}
	return false;
});

function executeActions(
	actions: Record<string, any>[],
	xpathMap: Record<number, string>
) {
	for (const action in actions) {
		switch (action) {
			case "click":
				const obj = document.evaluate(
					xpathMap[actions[action].index],
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
				if (obj instanceof HTMLElement) {
					obj.click();
				}
				break;
			case "scroll-down":
				window.scrollBy({ top: window.innerHeight * actions[action].fraction });
				break;
			case "scroll-up":
				window.scrollBy({
					top: -window.innerHeight * actions[action].fraction,
				});
				break;
			case "done":
				return true;
		}
	}
	return false;
}
