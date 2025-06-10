import os
from pathlib import Path

# --- Server Configuration ---
# Host address for the FastAPI server to listen on.
# Use "0.0.0.0" to listen on all available network interfaces (common for deployment).
# Use "127.0.0.1" or "localhost" if you only want it accessible from your machine.
HOST = os.getenv("APP_HOST", "0.0.0.0")

# Port number for the FastAPI server.
PORT = int(os.getenv("APP_PORT", 8000))

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
    "http://localhost:3000", # If you're using another dev port
]