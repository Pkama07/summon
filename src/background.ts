import { ChatOpenAI } from "@langchain/openai";
import {
	SystemMessage,
	HumanMessage,
	AIMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import sysPrompt from "./sys_prompt.md?raw";

interface Message {
	action: string;
	args?: any;
}

const modelOutputSchema = z.object({
	current_state: z.object({
		evaluation_previous_goal: z
			.string()
			.describe(
				"Success | Failed | Unknown — Analysis of the elements and image to determine whether the previous goals or actions were successfully completed as intended by the task. Note any unexpected outcomes and briefly explain why it succeeded or failed."
			),
		memory: z
			.string()
			.describe(
				"Clearly describe what has been done so far and what needs to be remembered. Be specific. Include a count wherever possible, e.g., '0 out of 10 questions answered'. Also, specify what remains to be done, such as continuing with ABC and XYZ."
			),
		next_goal: z
			.string()
			.describe(
				"Describe the intended effect of the actions you propose. On the next step, this description will be used to evaluate the outcome of the actions you propose, so be hyper specific."
			),
	}),
	actions: z
		.array(
			z.object({
				action_name: z.string().describe("The action to be executed"),
				parameters: z.array(z.string()),
			})
		)
		.describe(
			"A sequence of actions, each keyed by its action name and holding its specific parameters."
		),
});

const chatModel = new ChatOpenAI({
	model: "gpt-4o-mini",
	apiKey: "",
}).withStructuredOutput(modelOutputSchema);

chrome.runtime.onMessage.addListener((message: Message, _, sendResponse) => {
	if (message.action === "summon") {
		const { request } = message.args;
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			const tabId = tabs[0]?.id;
			let modelOutputs: z.infer<typeof modelOutputSchema>[] = [];
			if (tabId) {
				let done = false;
				let count = 0;
				while (!done && count < 5) {
					const stateInfo: {
						domTree: any;
						pixelsAbove: number;
						pixelsBelow: number;
					} = await new Promise((resolve) => {
						chrome.tabs.sendMessage(
							tabId,
							{ action: "gatherStateInfo" },
							(response) => {
								resolve(response);
							}
						);
					});
					const interactionMap: { [key: number]: any } = filterNodesAndGetText(
						stateInfo.domTree
					);
					const XPathMap: { [key: number]: string } = { 0: "window" };
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
					const messages = [
						new SystemMessage(sysPrompt),
						new HumanMessage({
							content: `The ultimate task: "${request}". If you've achieved the task, output the done action.`,
						}),
						...(modelOutputs.length == 0
							? [new HumanMessage({ content: "No previous steps taken." })]
							: [
									new HumanMessage({
										content: "Here are the previous steps you have taken:",
									}),
									...modelOutputs.map(
										(output) =>
											new AIMessage({
												content: JSON.stringify(output),
											})
									),
							  ]),
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
									text: `There are ${stateInfo.pixelsAbove} pixels above and ${stateInfo.pixelsBelow} pixels below the viewport.`,
								},
							],
						}),
					];
					console.log("messages", messages);
					const modelResponse = await chatModel.invoke(messages);
					console.log(modelResponse);
					chrome.tabs.sendMessage(
						tabId,
						{
							action: "execute",
							args: {
								actions: modelResponse.actions,
								xpathMap: XPathMap,
							},
						},
						(response) => {
							if (response.done) {
								done = true;
							}
						}
					);
					modelOutputs.push(modelResponse);
					count++;
				}
				console.log("Done");
			}
		});
		return true;
	} else if (message.action === "getInteractiveElements") {
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
				sendResponse({ textualInteractionMap });
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
