// JavaScript functionality can be added here

// Add conversation history tracking
let conversationHistory = [];

// Function to safely render markdown
function renderMarkdown(content) {
	// Check if marked is available
	if (typeof marked === "undefined") {
		console.warn("Marked library not loaded, falling back to plain text");
		return content;
	}

	try {
		// Configure marked for safe rendering
		marked.setOptions({
			breaks: true, // Convert line breaks to <br>
			sanitize: true, // Sanitize HTML input
			gfm: true, // Enable GitHub Flavored Markdown
		});
		return marked.parse(content); // Use marked.parse instead of just marked
	} catch (e) {
		console.error("Error rendering markdown:", e);
		return content;
	}
}

// Function to add chat messages
function addMessage(content, isUser = false, addToHistory = true) {
	const messagesDiv = document.getElementById("chat-messages");
	const messageDiv = document.createElement("div");
	messageDiv.className = `message ${isUser ? "user" : "assistant"}`;

	// Render markdown for assistant messages only
	if (isUser) {
		messageDiv.textContent = content;
	} else {
		messageDiv.innerHTML = renderMarkdown(content);
	}

	messagesDiv.appendChild(messageDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;

	// Add message to conversation history only if specified
	if (addToHistory) {
		conversationHistory.push({
			role: isUser ? "user" : "assistant",
			content: content,
		});
	}
	return messageDiv;
}

// Add function to reset chat
function resetChat() {
	// Clear conversation history
	conversationHistory = [];

	// Clear chat messages
	const chatMessages = document.getElementById("chat-messages");
	chatMessages.innerHTML = "";
}

// Move all event binding logic to a single function
function bindEventListeners() {
	// Handle file selection and automatic upload
	const fileInput = document.getElementById("file-input");
	const fileSelected = document.querySelector(".file-selected");
	const questionInput = document.getElementById("question-input");
	const askButton = document.getElementById("ask-button");

	if (fileInput && fileSelected) {
		fileInput.addEventListener("change", function () {
			if (fileInput.files.length > 0) {
				const fileName = fileInput.files[0].name;
				fileSelected.textContent = fileName;
				console.log("File selected:", fileName);

				// Automatically upload the file
				const form = document.getElementById("upload-form");
				const formData = new FormData(form);

				console.log("Sending fetch request...");

				fetch("/", {
					method: "POST",
					body: formData,
					credentials: "same-origin",
					headers: {
						"X-Requested-With": "XMLHttpRequest",
					},
				})
					.then((response) => {
						console.log("Response received:", response);
						return response.text();
					})
					.then((html) => {
						console.log("HTML received");
						// Create a temporary container to parse the HTML
						const tempDiv = document.createElement("div");
						tempDiv.innerHTML = html;

						// Update only the necessary parts of the page
						const newChaptersList =
							tempDiv.querySelector(".chapters-list");
						const newContent =
							tempDiv.querySelector("#chapter-content") ||
							tempDiv.querySelector(".empty-state");
						const contentPanel =
							document.querySelector(".content-panel");

						// Update chapters list
						const currentChaptersList =
							document.querySelector(".chapters-list");
						if (newChaptersList) {
							if (currentChaptersList) {
								currentChaptersList.replaceWith(
									newChaptersList
								);
							} else {
								// If there was no chapters list before, add it to left panel
								document
									.querySelector(".left-panel")
									.appendChild(newChaptersList);
							}
						}

						// Update content panel
						if (newContent) {
							if (contentPanel) {
								// Clear existing content
								contentPanel.innerHTML = "";
								// Add new content
								contentPanel.appendChild(newContent);
							}
						}

						// Keep the filename display
						fileSelected.textContent = fileName;

						// Rebind event listeners
						bindEventListeners();
					})
					.catch((error) => {
						console.error("Error:", error);
					});
			} else {
				fileSelected.textContent = "No file selected.";
			}
		});
	}

	// Handle question submission
	if (questionInput && askButton) {
		askButton.addEventListener("click", async function () {
			console.log("Ask button clicked");
			const question = questionInput.value.trim();
			if (!question) {
				console.log("Empty question, ignoring");
				return;
			}

			// Get current chapter content
			const chapterContent =
				document.getElementById("chapter-content")?.textContent;
			if (!chapterContent) {
				console.error("No chapter content found");
				return;
			}

			// Get CSRF token
			const csrfToken = document.querySelector(
				'input[name="csrf_token"]'
			)?.value;
			if (!csrfToken) {
				console.error("No CSRF token found");
				return;
			}

			console.log("Sending question:", question.substring(0, 50) + "...");

			// Add user's question to chat and history
			addMessage(question, true);
			questionInput.value = "";

			try {
				// Create message element for the response without adding to history yet
				const messageDiv = addMessage("", false, false);
				let fullResponse = "";

				console.log("Fetching response from server...");
				const response = await fetch("/ask", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Requested-With": "XMLHttpRequest",
						"X-CSRFToken": csrfToken,
					},
					body: JSON.stringify({
						question: question,
						chapter_content: chapterContent,
						conversation_history: conversationHistory,
					}),
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				console.log("Starting to read response stream...");
				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						console.log("Stream complete");
						break;
					}

					const text = decoder.decode(value);
					console.log(
						"Received chunk:",
						text.substring(0, 50) + "..."
					);
					const lines = text.split("\n");

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6));
								fullResponse += data.content;
								messageDiv.innerHTML =
									renderMarkdown(fullResponse);
								messageDiv.scrollIntoView({
									behavior: "smooth",
									block: "end",
								});
							} catch (e) {
								console.error("Error parsing SSE data:", e);
								console.error("Problematic line:", line);
							}
						}
					}
				}

				// Add the complete response to conversation history
				conversationHistory.push({
					role: "assistant",
					content: fullResponse,
				});
			} catch (error) {
				console.error("Error:", error);
				addMessage(
					"Sorry, I encountered an error while processing your question."
				);
			}
		});

		// Allow Enter key to submit
		questionInput.addEventListener("keypress", function (e) {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				askButton.click();
			}
		});
	}

	// Handle chapter selection
	const chaptersList = document.querySelector(".chapters-list");
	if (chaptersList) {
		console.log("Binding chapter click events");
		chaptersList.addEventListener("click", function (e) {
			const chapterItem = e.target.closest(".chapter-item");
			if (chapterItem) {
				console.log("Chapter clicked:", chapterItem.dataset.chapter);

				// Remove active class from all items
				document.querySelectorAll(".chapter-item").forEach((item) => {
					item.classList.remove("active");
				});

				// Add active class to clicked item
				chapterItem.classList.add("active");

				// Update content
				const chapterIndex = chapterItem.dataset.chapter;
				fetch(`/chapter/${chapterIndex}`, {
					headers: {
						"X-Requested-With": "XMLHttpRequest",
					},
					credentials: "same-origin",
				})
					.then((response) => {
						console.log("Chapter response:", response);
						return response.text();
					})
					.then((content) => {
						console.log("Chapter content received");
						const contentPanel =
							document.getElementById("chapter-content");
						if (contentPanel) {
							contentPanel.innerHTML = content;
							// Scroll to top of content
							contentPanel.scrollTop = 0;
							// Clear conversation history for new chapter
							conversationHistory = [];
							// Clear chat messages
							document.getElementById("chat-messages").innerHTML =
								"";
						} else {
							console.error("Content panel not found");
						}
					})
					.catch((error) => {
						console.error("Error loading chapter:", error);
					});
			}
		});
	} else {
		console.log("Chapters list not found");
	}

	// Handle new chat button
	const newChatButton = document.getElementById("new-chat-button");
	if (newChatButton) {
		newChatButton.addEventListener("click", function () {
			console.log("New chat requested");
			resetChat();
		});
	}
}

// Initialize event listeners when the page loads
document.addEventListener("DOMContentLoaded", bindEventListeners);
