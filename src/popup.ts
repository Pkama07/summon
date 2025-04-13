const summonButton = document.getElementById("summon-button");
if (summonButton == null) {
	throw new Error("Summon button not found");
}
summonButton.addEventListener("click", () => {
	console.log("Summon button clicked");
	chrome.runtime.sendMessage({ action: "summon" }, (response) => {
		if (chrome.runtime.lastError) {
			console.error("Error:", chrome.runtime.lastError);
			return;
		}
		console.log("Response:", response); // will log in the popup's own console
	});
});
