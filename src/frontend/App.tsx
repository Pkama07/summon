import { useState } from 'react';

export default function App() {
	const [input, setInput] = useState('');
	const [status, setStatus] = useState('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		setStatus('Processing...');
		try {
			// Send message to background script with the correct format
			const response = await chrome.runtime.sendMessage({ 
				action: "summon",
				args: { userInput: input.trim() }
			});
			
			console.log('Response from background:', response);
			setStatus('Command sent successfully!');
			setInput(''); // Clear the input after sending
			
			// Close the popup after a short delay
			setTimeout(() => window.close(), 1000);
		} catch (error) {
			console.error('Error sending message:', error);
			setStatus('Error sending command. Please try again.');
		}
	};

	return (
		<div className="min-w-[400px] p-4 bg-white">
			<div className="mb-4">
				<h1 className="text-xl font-bold text-gray-800">Summon Assistant</h1>
				<p className="text-sm text-gray-600">Tell me what to do on this page</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label htmlFor="command" className="block text-sm font-medium text-gray-700 mb-1">
						Your Command
					</label>
					<textarea
						id="command"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						rows={3}
						placeholder="e.g., Type the answer 14 and hit enter"
					/>
				</div>
				<div className="flex flex-col space-y-2">
					<button
						type="submit"
						className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						disabled={!input.trim()}
					>
						Execute Command
					</button>
					{status && (
						<p className={`text-sm ${status.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
							{status}
						</p>
					)}
				</div>
			</form>
		</div>
	);
}
