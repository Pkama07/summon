// a content script to execute the actions provided by the LLM

interface XPathAction {
	action: string;
	xpath: string;
	args: string[];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "execute" && message.args?.actions) {
		const { actions } = message.args;
		executeActions(actions);
		sendResponse({ success: true });
		return true;
	}
	return false;
});

function executeActions(actions: XPathAction[]) {
	for (const action of actions) {
		const obj = document.evaluate(
			action.xpath,
			document,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null
		).singleNodeValue;
		if (obj instanceof HTMLElement) {
			switch (action.action) {
				case "click":
					obj.click();
					break;
				case "fill":
					executeFill(obj, action.args[0]);
					break;
				case "scroll":
					window.scrollTo({
						top: Math.max(0, window.scrollY + Number(action.args[0])),
						behavior: "smooth",
					});
					break;
			}
		}
	}
}

function executeFill(obj: HTMLElement, value: string) {
	if (
		!(obj instanceof HTMLInputElement || obj instanceof HTMLTextAreaElement)
	) {
		console.error("Not a valid input element:", obj);
		return;
	}

	obj.focus();
	obj.value = value;

	obj.dispatchEvent(new Event("input", { bubbles: true }));
	obj.dispatchEvent(new Event("change", { bubbles: true }));
}
