from flask import (
    Blueprint,
    render_template,
    request,
    flash,
    send_file,
    current_app,
    session,
    jsonify,
)
from werkzeug.utils import secure_filename
import os
from app.utils.epub_processor import extract_chapters
from openai import OpenAI
import logging

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
            logger.info(f"Stored {len(chapters)} chapters in session")

            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                logger.info("AJAX request detected")
                return render_template("index.html", chapters=chapters)
            return render_template("index.html", chapters=chapters)

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

    logger.info(
        f"Received question: {question[:100]}..."
    )  # Log first 100 chars of question
    logger.info(
        f"Chapter content length: {len(chapter_content) if chapter_content else 0} characters"
    )

    if not question or not chapter_content:
        logger.error("Missing question or chapter content")
        return jsonify({"error": "Missing question or chapter content"}), 400

    try:
        # Prepare the prompt
        prompt = f"""You are a helpful assistant analyzing a book chapter.
        First read this chapter content:

        {chapter_content}

        Now answer this question about the chapter:
        {question}"""

        logger.info(
            f"Sending request to OpenAI API with prompt length: {len(prompt)} characters"
        )

        # Call OpenAI API
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant analyzing book content.",
                },
                {"role": "user", "content": prompt},
            ],
        )

        answer = response.choices[0].message.content
        logger.info(
            f"Received response from OpenAI API. Answer length: {len(answer)} characters"
        )
        logger.info(
            f"Answer preview: {answer[:100]}..."
        )  # Log first 100 chars of answer

        return jsonify({"answer": answer})

    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to get answer"}), 500
