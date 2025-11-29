from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import threading
from typing import Dict, Any, Optional

import database
import image_processor
import auth
import models
from schemas import ReprocessRequest

# Initialize FastAPI Router for core routes
router = APIRouter()

# --- Core API Endpoints ---

@router.post("/scan-files/", summary="Trigger File System Scan", response_model=Dict[str, str])
def trigger_file_scan(current_user: models.User = Depends(auth.get_current_admin_user)):
    # Triggers a manual scan of configured image paths for new images/videos and subdirectories.

    print("Manual file scan triggered via API. Starting in background thread...")

    def run_scan_in_thread():
        # Create a new database session specifically for this background thread
        db_session = database.SessionLocal()
        try:
            image_processor.scan_paths(db=db_session)
        finally:
            db_session.close()

    scan_thread = threading.Thread(target=run_scan_in_thread)
    scan_thread.daemon = True
    scan_thread.start()

    return {"message": "File scan successfully initiated in the background. Check server logs for progress."}

@router.post("/reprocess-metadata/", summary="Trigger Metadata Reprocessing", response_model=Dict[str, str])
def trigger_metadata_reprocessing(
    request: ReprocessRequest,
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    """
    Triggers a background task to reprocess metadata (EXIF, width, height) for media files.
    This is an admin-only endpoint.

    - **scope**: 'file', 'directory', or 'all'.
    - **identifier**: Required for 'file' (ImageLocation ID) and 'directory' (full path string). Not used for 'all'.
    """
    print(f"Manual metadata reprocessing triggered via API for scope '{request.scope}'. Starting in background thread...")

    # The image_processor.reprocess_metadata_task expects the session factory, not a session instance
    db_session_factory = database.SessionLocal

    # Run the reprocessing task in a background thread to avoid blocking the API response
    reprocess_thread = threading.Thread(
        target=image_processor.reprocess_metadata_task,
        args=(db_session_factory, request.scope, request.identifier)
    )
    reprocess_thread.daemon = True
    reprocess_thread.start()

    return {"message": f"Metadata reprocessing for scope '{request.scope}' initiated in the background. Check server logs for progress."}