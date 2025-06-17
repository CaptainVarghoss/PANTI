from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import threading
from typing import Dict, Any

import database
import scanner
import auth
import models

# Initialize FastAPI Router for core routes
router = APIRouter()

# --- Core API Endpoints ---

@router.post("/scan-files/", summary="Trigger File System Scan", response_model=Dict[str, str])
def trigger_file_scan(current_user: models.User = Depends(auth.get_current_admin_user)):
    # Triggers a manual scan of configured image paths for new images/videos and subdirectories.

    print("Manual file scan triggered via API. Starting in background thread...")

    def run_scan_in_thread():
        thread_db = database.SessionLocal()
        try:
            scanner.scan_paths(thread_db)
        finally:
            thread_db.close()

    scan_thread = threading.Thread(target=run_scan_in_thread)
    scan_thread.daemon = True
    scan_thread.start()

    return {"message": "File scan successfully initiated in the background. Check server logs for progress."}