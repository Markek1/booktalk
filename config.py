import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "your-secret-key-here"
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    WTF_CSRF_ENABLED = True
    PERMANENT_SESSION_LIFETIME = timedelta(
        minutes=30
    )  # Session expires after 30 minutes
    SESSION_TYPE = "filesystem"  # Store sessions in filesystem
