import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import sysPrompt from "./sys_prompt.md?raw";

interface Message {
	action: string;
	args?: any;
}

const modelOutputSchema = z.object({
	textResponse: z
		.string()
		.describe(
			"The textual output to be displayed to the user along with the execution of the actions"
		),
	actions: z
		.array(
			z.object({
				action: z
					.string()
					.describe("The action to be executed (click, fill, or scroll)"),
				index: z
					.number()
					.describe("The index of the element to be interacted with"),
				args: z.string().describe("The payload to be passed to the action"),
			})
		)
		.describe("The array of actions to be executed"),
});

const chatModel = new ChatOpenAI({
	model: "gpt-4o-mini",
	apiKey: process.env.OPENAI_API_KEY,
}).withStructuredOutput(modelOutputSchema);

chrome.runtime.onMessage.addListener((message: Message, _, sendResponse) => {
	if (message.action === "summon") {
		const { userInput } = message.args;
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
				const XPathMap: { [key: number]: string } = {};
				for (const [index, element] of Object.entries(interactionMap)) {
					XPathMap[Number(index)] = element.xpath;
				}
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
							resolve(response.result);
						}
					);
				});

				// load the system prompt
				const messages = [
					new SystemMessage(sysPrompt),
					new HumanMessage({
						content: [
							{
								type: "text",
								text:
									"Here is the screenshot of the page with the interactive elements highlighted.",
							},
							{
								type: "image_url",
								image_url: { url: processedScreenshot },
							},
							{
								type: "text",
								text: "Here is the list of interactive elements on the page.",
							},
							{
								type: "text",
								text: textualInteractionMap,
							},
							{
								type: "text",
								text: userInput,
							},
						],
					}),
				];
				const modelResponse = await chatModel.invoke(messages);
				chrome.tabs.sendMessage(tabId, {
					action: "execute",
					args: {
						actions: modelResponse.actions.map((action) => ({
							action: action.action,
							xpath: XPathMap[action.index],
							args: action.args,
						})),
					},
				});
				sendResponse(modelResponse);
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
