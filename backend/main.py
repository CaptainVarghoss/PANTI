from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

import config

app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers
)
# --- End CORS Configuration ---

@app.get("/api/message")
async def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/items/{item_id}")
async def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

@app.post("/api/data")
async def create_data(data: dict):
    return {"received_data": data, "message": "Data received successfully!"}

# --- Serve Static Files (Frontend) ---
# Check if the frontend build directory exists before mounting StaticFiles.
# This ensures that `uvicorn` doesn't fail if the frontend hasn't been built yet.
if config.FRONTEND_BUILD_DIR.is_dir():
    # Mount the static files directory.
    # The `html=True` argument ensures that if a file like `index.html` is requested
    # directly, it will be served. More importantly, it allows serving `index.html`
    # for all routes that don't match an API endpoint, which is crucial for
    # client-side routing (e.g., React Router).
    app.mount(
        "/", # Serve the frontend from the root URL of the FastAPI application
        StaticFiles(directory=config.FRONTEND_BUILD_DIR, html=True),
        name="frontend"
    )
    print(f"Serving frontend from: {config.FRONTEND_BUILD_DIR}")
else:
    print(f"Frontend build directory not found at: {config.FRONTEND_BUILD_DIR}")
    print("Please run 'npm run build' in the frontend directory first.")