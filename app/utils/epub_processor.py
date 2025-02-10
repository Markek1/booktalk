import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


def extract_chapters(epub_path):
    book = epub.read_epub(epub_path)

    chapters = []

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_body_content(), "html.parser")

            title = soup.find("h1") or soup.find("h2") or soup.find("h3")
            if title:
                title = title.get_text()
            else:
                title = "Untitled Chapter"

            content = str(soup.body) if soup.body else str(soup)
            content = content.replace("<body>", "").replace("</body>", "")

            chapters.append({"title": title, "content": content})

    return chapters
