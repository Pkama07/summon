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
			if (tabs[0]?.id) {
				const translation = await translateToFrench(
					"Translate the following from English into Italian"
				);
				chrome.scripting
					.executeScript({
						target: { tabId: tabs[0].id },
						func: (message?: string) => {
							console.log(message);
						},
						args: [String(translation)],
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

async function translateToFrench(text: string) {
	const messages = [
		new SystemMessage("Translate the following from English into French"),
		new HumanMessage(text),
	];
	const result = await chatModel.invoke(messages);
	return result.content;
}
