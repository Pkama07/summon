// a content script to execute the actions provided by the LLM

interface Action {
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

function executeActions(actions: Action[]) {
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
					executeClick(obj);
					break;
				case "fill":
					executeFill(obj, action.args[0]);
					break;
				case "scroll":
					executeScroll(Number(action.args[0]));
					break;
			}
		}
	}
}

function executeClick(obj: HTMLElement) {
	obj.click();
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

function executeScroll(amount: number) {
	window.scrollTo({
		top: Math.max(0, window.scrollY + amount),
		behavior: "smooth",
	});
}
