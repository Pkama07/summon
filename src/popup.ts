const summonButton = document.getElementById("summon-button");
const userInput = document.getElementById("user-input");
if (summonButton == null) {
	throw new Error("Summon button not found");
}
if (userInput == null || !(userInput instanceof HTMLTextAreaElement)) {
	throw new Error("User input not found");
}
summonButton.addEventListener("click", () => {
	chrome.runtime.sendMessage(
		{ action: "summon", args: { userInput: userInput.value } },
		(response) => {
			console.log("response", response);
			if (chrome.runtime.lastError) {
				console.error("Error:", chrome.runtime.lastError);
				return;
			}
		}
	);
});
