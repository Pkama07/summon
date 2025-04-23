// a content script to execute the actions provided by the LLM

interface Action {
	action_name: string;
	parameters: string[];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "execute" && message.args?.actions) {
		const { actions, xpathMap } = message.args;
		const done = executeActions(actions, xpathMap);
		sendResponse({ done });
		return true;
	}
	return false;
});

function executeActions(actions: Action[], xpathMap: Record<number, string>) {
	for (const action of actions) {
		switch (action.action_name) {
			case "click":
				const obj = document.evaluate(
					xpathMap[Number(action.parameters[0])],
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
				window.scrollBy({
					top: window.innerHeight * Number(action.parameters[0]),
				});
				break;
			case "scroll-up":
				window.scrollBy({
					top: -window.innerHeight * Number(action.parameters[0]),
				});
				break;
			case "done":
				return true;
		}
	}
	return false;
}
