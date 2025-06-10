#!/bin/bash

# start.sh
# This script builds the React frontend and then starts the FastAPI backend.

# --- Configuration ---
# Read configuration from the Python config file
# We'll use a trick to execute Python code and get values for the script
# This makes sure our shell script uses the same config values as our Python app.
# Note: This is a basic way to read config. For more complex setups,
# you might use a dedicated tool or just set environment variables directly.
FASTAPI_HOST=$(python -c "import sys; sys.path.append('backend'); import config; print(config.HOST)")
FASTAPI_PORT=$(python -c "import sys; sys.path.append('backend'); import config; print(config.PORT)")
FRONTEND_DIR=$(python -c "import sys; sys.path.append('backend'); import config; print(config.FRONTEND_DIR_NAME)")

# --- Navigate to frontend and build ---
echo "--- Building React Frontend ---"
cd "$FRONTEND_DIR" || { echo "Error: Frontend directory '$FRONTEND_DIR' not found."; exit 1; }

# Install frontend dependencies (if not already installed)
echo "Installing frontend dependencies..."
npm install

# Build the React application for production
echo "Running npm run build..."
npm run build || { echo "Error: Frontend build failed."; exit 1; }

echo "Frontend build completed successfully."

# --- Navigate back to project root and activate backend virtual environment ---
cd .. # Go back to your-fullstack-app/
echo "--- Preparing FastAPI Backend ---"
cd backend || { echo "Error: Backend directory not found."; exit 1; }

# Activate Python virtual environment
# This path might need adjustment based on your OS and venv setup
echo "Activating Python virtual environment..."
source .venv/bin/activate || { echo "Error: Could not activate virtual environment. Make sure it exists and is correctly set up."; exit 1; }

# --- Start FastAPI Application ---
echo "--- Starting FastAPI Server ---"
echo "Server will run on http://$FASTAPI_HOST:$FASTAPI_PORT"

# Run FastAPI with Uvicorn.
# Using --host 0.0.0.0 is crucial for external access in many deployment environments.
# --port uses the configured port from config.py
# --workers can be increased for production to handle more concurrent requests.
# (e.g., --workers 4 or more, depending on your server's CPU cores)
uvicorn main:app --host "$FASTAPI_HOST" --port "$FASTAPI_PORT" --workers 1 # Using 1 worker for simplicity