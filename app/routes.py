from flask import (
    Blueprint,
    render_template,
    request,
    flash,
    send_file,
    current_app,
    session,
    jsonify,
    Response,
)
from werkzeug.utils import secure_filename
import os
from app.utils.epub_processor import extract_chapters
from openai import OpenAI
import logging
import json

main = Blueprint("main", __name__)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)


@main.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        logger.info("POST request received")

        if "file" not in request.files:
            logger.warning("No file part in request")
            flash("No file part")
            return render_template("index.html")

        file = request.files["file"]
        logger.info(f"File received: {file.filename}")

        if file.filename == "":
            logger.warning("No selected file")
            flash("No selected file")
            return render_template("index.html")

        if file and file.filename.endswith(".epub"):
            filename = secure_filename(file.filename)
            filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
            file.save(filepath)
            logger.info(f"File saved to: {filepath}")

            # Process the EPUB file
            chapters = extract_chapters(filepath)

            # Store chapters in session with proper serialization
            session["chapters"] = [
                {"title": ch["title"], "content": ch["content"]} for ch in chapters
            ]
            session["current_filename"] = filename  # Store filename in session
            logger.info(f"Stored {len(chapters)} chapters in session")

            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                logger.info("AJAX request detected")
                return render_template(
                    "index.html", chapters=chapters, current_filename=filename
                )
            return render_template(
                "index.html", chapters=chapters, current_filename=filename
            )

        flash("Please upload an EPUB file")
    return render_template("index.html")


@main.route("/chapter/<int:chapter_index>")
def get_chapter(chapter_index):
    chapters = session.get("chapters", [])
    logger.info(f"Fetching chapter {chapter_index}, total chapters: {len(chapters)}")

    if not chapters:
        logger.warning("No chapters in session")
        return "No chapters loaded", 404

    try:
        chapter_index = int(chapter_index)
        if 0 <= chapter_index < len(chapters):
            content = chapters[chapter_index]["content"]
            logger.info(f"Returning chapter {chapter_index} with length {len(content)}")
            return content
        else:
            logger.warning(f"Chapter index {chapter_index} out of range")
            return "Chapter index out of range", 404
    except Exception as e:
        logger.error(f"Error accessing chapter: {str(e)}", exc_info=True)
        return "Error accessing chapter", 500


@main.route("/ask", methods=["POST"])
def ask_question():
    data = request.json
    question = data.get("question")
    chapter_content = data.get("chapter_content")
    conversation_history = data.get("conversation_history", [])

    logger.info(f"Received question: {question[:100]}...")
    logger.info(
        f"Chapter content length: {len(chapter_content) if chapter_content else 0} characters"
    )
    logger.info(f"Conversation history length: {len(conversation_history)}")

    if not question or not chapter_content:
        logger.error("Missing question or chapter content")
        return jsonify({"error": "Missing question or chapter content"}), 400

    try:
        # Prepare the system message with context
        system_message = f"""You are a distinguished professor with decades of teaching experience,
        known for your ability to explain complex topics in clear,
        simple terms. You excel at breaking down difficult concepts into concise,
        easily digestible explanations that students can readily understand. You have a gift
        for providing relevant, memorable examples that perfectly illustrate key concepts and
        make abstract ideas concrete and accessible.
        You are helping a student understand a chapter of a book.

        Here is the chapter content for reference:

        {chapter_content}

        Please answer questions about this chapter while maintaining context from the conversation."""

        # Build messages array with conversation history
        messages = [
            {"role": "system", "content": system_message},
        ]

        # Add conversation history
        messages.extend(conversation_history)

        # Add the new question
        messages.append({"role": "user", "content": question})

        total_length = sum(len(message["content"]) for message in messages)
        logger.info(
            f"Sending request with {len(messages)} messages and total length {total_length}"
        )

        def generate():
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                stream=True,
            )

            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"

        return Response(generate(), mimetype="text/event-stream")

    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to get answer"}), 500
