import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

interface Message {
	action: string;
	payload?: any;
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
				args: z.any().describe("The payload to be passed to the action"),
			})
		)
		.describe("The array of actions to be executed"),
});

const chatModel = new ChatOpenAI({
	model: "gpt-4o-mini",
	apiKey: process.env.OPENAI_API_KEY,
}).withStructuredOutput(modelOutputSchema, { name: "output schema" });

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
				const xpathMap: { [key: number]: string } = {};
				for (const [index, element] of Object.entries(interactionMap)) {
					xpathMap[Number(index)] = element.xpath;
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
							resolve(response);
						}
					);
				});

				// load the system prompt
				const systemPrompt = await loadFile("assets/sys_prompt.md");
				const messages = [
					new SystemMessage(systemPrompt),
					new HumanMessage({
						content: [
							{
								type: "text",
								text: "Here is the screenshot of the page with the interactive elements highlighted.",
							},
							{
								type: "image_url",
								image_url: { url: processedScreenshot },
							},
							{
								type: "text",
								text: "\nHere is the list of interactive elements on the page.",
							},
							{
								type: "text",
								text: textualInteractionMap,
							},
						],
					}),
				];
				console.log(messages);
				// const modelResponse = await chatModel.invoke(messages);
				// sendResponse(modelResponse);
			}
		});
		return true;
	}
	return false;
});

async function loadFile(filePath: string) {
	const fileUrl = chrome.runtime.getURL(filePath);
	const response = await fetch(fileUrl);
	return await response.text();
}

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
