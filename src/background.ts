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
				const response = await new Promise((resolve) => {
					chrome.tabs.sendMessage(
						tabId,
						{ action: "buildDomTree" },
						(response) => {
							resolve(response);
						}
					);
				});
				console.log("DOM Tree Response:", response);
				console.log("Filtered Map:", filterNodes(response));
			}
		});
		return true;
	}
	return false;
});

function filterNodes(domTree: any): any {
	if (!domTree || !domTree.map) {
		return domTree;
	}

	const filteredMap: { [key: string]: any } = {};
	const rootId = domTree.rootId;

	function processNode(nodeId: string): string | null {
		const node = domTree.map[nodeId];
		if (!node) return null;

		// Always include text nodes
		if (node.type === "TEXT_NODE") {
			const newId = `${Object.keys(filteredMap).length}`;
			filteredMap[newId] = node;
			return newId;
		}

		// Include interactive elements
		if (node.isInteractive) {
			const newNode = {
				...node,
				children: [] as string[],
			};

			// Process all children
			if (node.children) {
				for (const childId of node.children) {
					const newChildId = processNode(childId);
					if (newChildId) {
						newNode.children.push(newChildId);
					}
				}
			}

			const newId = `${Object.keys(filteredMap).length}`;
			filteredMap[newId] = newNode;
			return newId;
		}

		// For non-interactive elements, only process their children
		if (node.children) {
			const newChildren: string[] = [];
			for (const childId of node.children) {
				const newChildId = processNode(childId);
				if (newChildId) {
					newChildren.push(newChildId);
				}
			}

			// Only include the node if it has interactive children
			if (newChildren.length > 0) {
				const newNode = {
					...node,
					children: newChildren,
				};
				const newId = `${Object.keys(filteredMap).length}`;
				filteredMap[newId] = newNode;
				return newId;
			}
		}

		return null;
	}

	const newRootId = processNode(rootId);
	return {
		rootId: newRootId,
		map: filteredMap,
	};
}
