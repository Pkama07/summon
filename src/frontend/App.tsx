import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface Message {
	role: "user" | "assistant";
	content: string;
}

export default function App() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const userMessage: Message = { role: "user", content: input };
		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			// TODO: Replace with your actual API call
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: input }),
			});

			if (!response.ok) throw new Error("Failed to fetch response");

			const reader = response.body?.getReader();
			if (!reader) throw new Error("No reader available");

			let assistantMessage = "";
			setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				assistantMessage += chunk;

				setMessages((prev) => {
					const newMessages = [...prev];
					newMessages[newMessages.length - 1] = {
						role: "assistant",
						content: assistantMessage,
					};
					return newMessages;
				});
			}
		} catch (error) {
			console.error("Error:", error);
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "Sorry, there was an error processing your request.",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	return <div className="text-red-500">iwuefoewf</div>;

	return (
		<div className="w-[400px] h-[600px] flex flex-col">
			<Card className="flex-1 flex flex-col overflow-hidden m-0 rounded-none">
				<ScrollArea className="flex-1 p-4">
					<div className="space-y-4">
						{messages.map((message, index) => (
							<div
								key={index}
								className={`flex ${
									message.role === "user" ? "justify-end" : "justify-start"
								}`}
							>
								<div
									className={`max-w-[80%] rounded-lg p-3 ${
										message.role === "user"
											? "bg-primary text-primary-foreground"
											: "bg-muted"
									}`}
								>
									{message.content}
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>
				</ScrollArea>

				<form onSubmit={handleSubmit} className="p-4 border-t">
					<div className="flex gap-2">
						<Input
							value={input}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setInput(e.target.value)
							}
							placeholder="Type your message..."
							disabled={isLoading}
							className="flex-1"
						/>
						<Button type="submit" disabled={isLoading || !input.trim()}>
							{isLoading ? "Sending..." : "Send"}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	);
}
