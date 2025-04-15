import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

interface Message {
	action: string;
	payload?: any;
}

const chatModel = new ChatOpenAI({
	model: "gpt-4o-mini",
	apiKey: process.env.OPENAI_API_KEY,
});

chrome.runtime.onMessage.addListener((message: Message, _, sendResponse) => {
	if (message.action === "summon") {
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			const tabId = tabs[0]?.id;
			if (tabId) {
				const interactionMap: { [key: number]: any } = await new Promise(
					(resolve) => {
						chrome.tabs.sendMessage(
							tabId,
							{ action: "buildDomTree" },
							(response) => {
								resolve(filterNodesAndGetText(response));
							}
						);
					}
				);
				const textualInteractionMap = textifyElementMap(interactionMap);
				const window = await chrome.windows.getCurrent();
				const rawScreenshot = await new Promise((resolve) => {
					if (window.id) {
						chrome.tabs.captureVisibleTab(
							window.id,
							{ format: "png" },
							(dataUrl) => resolve(dataUrl)
						);
					} else {
						resolve("");
					}
				});
				const processedScreenshot = await new Promise((resolve) => {
					chrome.tabs.sendMessage(
						tabId,
						{
							action: "processScreenshot",
							args: { rawScreenshot },
						},
						(response) => {
							resolve(response);
						}
					);
				});
			}
		});
		return true;
	}
	return false;
});

function filterNodesAndGetText(domTree: any) {
	if (!domTree || !domTree.map) {
		return [];
	}
	const elementMap: { [key: number]: any } = {};
	const map = domTree.map;

	function processNode(nodeId: string): string[] {
		const node = map[nodeId];

		if (node.type === "TEXT_NODE") {
			return [node.text];
		}

		let internalText: string[] = [];
		for (const childId of node.children) {
			internalText.push(...processNode(childId));
		}

		if (!node.isInteractive) {
			return internalText;
		} else {
			elementMap[node.highlightIndex] = {
				...node,
				internalText,
			};
			return [];
		}
	}

	processNode(domTree.rootId);
	return elementMap;
}

function textifyElementMap(elementMap: { [key: number]: any }) {
	return Object.values(elementMap)
		.map((element) => textifyEntry(element.highlightIndex, element))
		.join("\n");
}

function textifyEntry(index: number, obj: any) {
	const attributeString = Object.entries(obj.attributes)
		.map(([key, value]) => `${key}="${value}"`)
		.join(" ");
	return `[${index}]<${obj.tagName} ${attributeString}>${obj.internalText.join(
		" "
	)}</${obj.tagName}>`;
}
