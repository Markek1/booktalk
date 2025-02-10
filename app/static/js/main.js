// JavaScript functionality can be added here

// Function to add chat messages
function addMessage(content, isUser = false) {
	const messagesDiv = document.getElementById("chat-messages");
	const messageDiv = document.createElement("div");
	messageDiv.className = `message ${isUser ? "user" : "assistant"}`;
	messageDiv.textContent = content;
	messagesDiv.appendChild(messageDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Move all event binding logic to a single function
function bindEventListeners() {
	// Handle file selection
	const fileInput = document.getElementById("file-input");
	const fileSelected = document.querySelector(".file-selected");
	const uploadButton = document.getElementById("upload-button");
	const questionInput = document.getElementById("question-input");
	const askButton = document.getElementById("ask-button");

	if (fileInput && fileSelected && uploadButton) {
		// File selection handler
		fileInput.addEventListener("change", function () {
			if (fileInput.files.length > 0) {
				fileSelected.textContent = fileInput.files[0].name;
			} else {
				fileSelected.textContent = "No file selected.";
			}
		});

		// File upload handler
		uploadButton.addEventListener("click", function () {
			console.log("Upload button clicked");
			const form = document.getElementById("upload-form");
			const fileInput = document.getElementById("file-input");

			console.log("File input:", fileInput.files);

			if (fileInput.files.length > 0) {
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
						document.documentElement.innerHTML = html;
						// Rebind event listeners after updating the DOM
						bindEventListeners();
					})
					.catch((error) => {
						console.error("Error:", error);
					});
			} else {
				console.log("No file selected");
			}
		});
	}

	// Handle question submission
	if (questionInput && askButton) {
		askButton.addEventListener("click", async function () {
			console.log("Ask button clicked");
			const question = questionInput.value.trim();
			if (!question) return;

			// Get current chapter content
			const chapterContent =
				document.getElementById("chapter-content").textContent;

			// Get CSRF token
			const csrfToken = document.querySelector(
				'input[name="csrf_token"]'
			).value;

			// Add user's question to chat
			addMessage(question, true);
			questionInput.value = "";

			try {
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
					}),
				});

				const data = await response.json();
				if (data.error) {
					addMessage("Sorry, I encountered an error: " + data.error);
				} else {
					addMessage(data.answer);
				}
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
}

// Initialize event listeners when the page loads
document.addEventListener("DOMContentLoaded", bindEventListeners);
