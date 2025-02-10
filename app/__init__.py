from flask import Flask
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from config import Config
import logging
import os
from logging.handlers import RotatingFileHandler


def setup_logging(app):
    # Create logs directory if it doesn't exist
    if not os.path.exists("logs"):
        os.mkdir("logs")

    # Set up file handler
    file_handler = RotatingFileHandler(
        "logs/book_reader.log", maxBytes=10240, backupCount=10
    )
    file_handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
        )
    )
    file_handler.setLevel(logging.INFO)

    # Set up console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    # Add handlers to app logger
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.INFO)

    app.logger.info("Book Reader startup")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Set up logging
    setup_logging(app)

    # Initialize CSRF protection
    csrf = CSRFProtect(app)

    # Initialize session handling
    Session(app)

    # Ensure the uploads directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    from app.routes import main

    app.register_blueprint(main)

    return app
