import os
from pathlib import Path

# --- Server Configuration ---
# Host address for the FastAPI server to listen on.
# Use "0.0.0.0" to listen on all available network interfaces (common for deployment).
# Use "127.0.0.1" or "localhost" if you only want it accessible from your machine.
HOST = os.getenv("APP_HOST", "0.0.0.0")

# Port number for the FastAPI server.
PORT = int(os.getenv("APP_PORT", 8000))

# --- Security Settings ---
# Access Token Expiration Time (in minutes)
# Example: 30 minutes, 7 days (10080), 30 days (43200)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 43200)) # Default to 30 minutes

# Secret key for JWT token signing.
# IMPORTANT: In production, always set this via an environment variable (e.g., SECRET_KEY="your_actual_strong_key").
# You can generate a strong key using: openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-replace-me") # Default placeholder

# --- Frontend Build Configuration ---
# Name of the frontend directory relative to 'your-fullstack-app'
FRONTEND_DIR_NAME = "frontend"

# Name of the directory where Vite outputs the built static files
# (usually 'dist' by default for Vite).
FRONTEND_BUILD_DIR_NAME = "dist"

# Construct the absolute path to the frontend's build directory.
# This assumes 'config.py' is in 'backend/' and 'frontend/' is a sibling.
# Adjust if your project structure is different.
CURRENT_DIR = Path(__file__).parent
PROJECT_ROOT = CURRENT_DIR.parent
FRONTEND_BUILD_DIR = PROJECT_ROOT / FRONTEND_DIR_NAME / FRONTEND_BUILD_DIR_NAME

# --- CORS Origins
CORS_ALLOWED_ORIGINS = [
    f"http://{HOST}:{PORT}",
    f"https://{HOST}:{PORT}", # Include HTTPS for production scenarios
    "http://localhost:5173", # Keep for separate frontend development (Vite's default)
    "http://127.0.0.1:5173",
]

# --- Database Configuration ---
# SQLite database file will be stored in the backend directory
DATABASE_FILE = "sql_app.db"
DATABASE_URL = f"sqlite:///{CURRENT_DIR / DATABASE_FILE}"
SQLALCHEMY_DATABASE_URL = DATABASE_URL
SQLALCHEMY_CONNECT_ARGS = {"check_same_thread": False}


# --- Media Configuration ---
# Top-level static directory relative to project root
STATIC_DIR_NAME = "static"
STATIC_DIR = PROJECT_ROOT / STATIC_DIR_NAME

DEFAULT_STATIC_IMAGES_DIR_NAME = "images"
DEFAULT_STATIC_IMAGES_DIR = STATIC_DIR / DEFAULT_STATIC_IMAGES_DIR_NAME

# Subdirectories for generated media within 'static'
GENERATED_MEDIA_DIR_NAME = "generated_media"
THUMBNAILS_DIR_NAME = "thumbnails"
PREVIEWS_DIR_NAME = "previews"

# Absolute paths for generated media storage
GENERATED_MEDIA_ROOT = STATIC_DIR / GENERATED_MEDIA_DIR_NAME
THUMBNAILS_DIR = GENERATED_MEDIA_ROOT / THUMBNAILS_DIR_NAME
PREVIEWS_DIR = GENERATED_MEDIA_ROOT / PREVIEWS_DIR_NAME

# Sizes for generated images
THUMBNAIL_SIZE = 400 # Width, Height
PREVIEW_SIZE = 1024 # Width, Height

# URL path where generated media will be served by FastAPI
# All contents of STATIC_DIR will be served under this prefix
STATIC_FILES_URL_PREFIX = "/static_assets"

# Create these directories if they don't exist
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)