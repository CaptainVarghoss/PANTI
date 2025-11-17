from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, not_
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import os, json, threading, mimetypes, asyncio
from search_constructor import generate_image_search_filter
from websocket_manager import manager # Import the WebSocket manager

import auth
import database
import models
import schemas
import config
import image_processor

router = APIRouter()

# --- Image Endpoints ---

@router.get("/thumbnails/{image_id}", response_class=FileResponse)
async def get_thumbnail(image_id: int, db: Session = Depends(database.get_db)):
    
    # Serves thumbnails. If a thumbnail doesn't exist, it triggers generation and returns a placeholder.

    db_image = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if not db_image:
        print(f"Image with ID {image_id} not found")
        raise HTTPException(status_code=404, detail="Image not found")

    expected_thumbnail_path = os.path.join(config.THUMBNAILS_DIR, f"{db_image.content_hash}_thumb.webp")

    if os.path.exists(expected_thumbnail_path):
        return FileResponse(expected_thumbnail_path, media_type="image/webp")
    else:
        # Trigger background generation
        original_filepath = os.path.join(db_image.path, db_image.filename)

        thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
        config_thumbnail_size = config.THUMBNAIL_SIZE

        if thumb_size_setting and thumb_size_setting.value:
            thumb_size = int(thumb_size_setting.value)
        else:
            thumb_size = config_thumbnail_size

        if original_filepath and Path(original_filepath).is_file():
            loop = asyncio.get_running_loop()
            thread = threading.Thread(
                target=image_processor.generate_thumbnail_in_background,
                args=(image_id, db_image.content_hash, original_filepath, loop)
            )
            thread.daemon = True
            thread.start()
        else:
            print(f"Could not trigger thumbnail generation for {db_image.filename}: original_filepath not found or invalid.")

        # Return a placeholder image or a loading indicator
        placeholder_path = os.path.join(config.STATIC_DIR, "placeholder.png")  # Or a loading animation
        return FileResponse(placeholder_path, media_type="image/png")

@router.get("/images/", response_model=List[schemas.ImageContent])
def read_images(
    limit: int = 100,
    search_query: Optional[str] = Query(None, description="Search term for filename or path"),
    sort_by: str = Query("date_created", description="Column to sort by (e.g., filename, date_created, checksum)"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'"),
    last_id: Optional[int] = Query(None, description="ID of the last item from the previous page for cursor-based pagination"),
    last_sort_value: Optional[str] = Query(None, description="Value of the sort_by column for the last_id item (for stable pagination)"),
    db: Session = Depends(database.get_db),
    filter: List[int] = Query(None),
    trash_only: bool = Query(False, description="If true, only returns images marked as deleted."),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves a list of images with support for searching, sorting, and cursor-based pagination.
    Accessible by all. Eager loads associated tags and includes paths to generated media.
    Triggers thumbnail generation if not found.
    """
    query = db.query(models.ImageLocation).distinct()
    query = query.join(models.ImageContent, models.ImageLocation.content_hash == models.ImageContent.content_hash)
    query = query.outerjoin(models.ImagePath, models.ImagePath.path == models.ImageLocation.path)
    query = query.options(
        joinedload(models.ImageLocation.content).joinedload(models.ImageContent.tags)
    )

    if trash_only:
        query = query.filter(models.ImageLocation.deleted == True)
    else:
        # If not viewing trash, filter out deleted items and apply search/filter criteria
        query = query.filter(models.ImageLocation.deleted == False)
        # Apply search filter if provided
        query = query.filter(generate_image_search_filter(search_terms=search_query, admin=current_user.admin, filters=filter, db=db))


    # Apply cursor-based pagination (Keyset Pagination)
    if last_id is not None and last_sort_value is not None:
        # Determine the column to sort by
        sort_column = getattr(models.ImageContent, sort_by)

        # Handle type conversion for last_sort_value based on sort_by column's type
        # Especially crucial for `date_created` which is a datetime object
        converted_last_sort_value = last_sort_value
        if sort_by == 'date_created':
            try:
                # Convert ISO string back to datetime for comparison
                converted_last_sort_value = datetime.fromisoformat(last_sort_value.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format for last_sort_value.")
        elif sort_by in ['content_hash', 'filename']:
            # These are strings, no special conversion needed
            pass # Keep as string

        if sort_order == 'desc':
            # For descending, we want items where sort_column < last_sort_value
            # OR (sort_column = last_sort_value AND id < last_id)
            query = query.filter(
                or_(
                    sort_column < converted_last_sort_value,
                    and_(sort_column == converted_last_sort_value, models.ImageLocation.id < last_id)
                )
            )
        else: # sort_order == 'asc'
            # For ascending, we want items where sort_column > last_sort_value
            # OR (sort_column = last_sort_value AND id > last_id)
            query = query.filter(
                or_(
                    sort_column > converted_last_sort_value,
                    and_(sort_column == converted_last_sort_value, models.ImageLocation.id > last_id)
                )
            )

    # Apply sorting
    sort_model = models.ImageContent
    if sort_by == 'filename':
        sort_model = models.ImageLocation
    
    if sort_order == 'desc':
        query = query.order_by(getattr(sort_model, sort_by).desc(), models.ImageLocation.id.desc())
    else: # 'asc'
        query = query.order_by(getattr(sort_model, sort_by).asc(), models.ImageLocation.id.asc())

    # Apply limit
    images = query.limit(limit).all()

    response_images = []
    for location in images:
        img = location.content
        # Check if thumbnail exists, if not, trigger generation in background
        expected_thumbnail_path = os.path.join(config.THUMBNAILS_DIR, f"{img.content_hash}_thumb.webp")
        if not os.path.exists(expected_thumbnail_path):
            print(f"Thumbnail for {location.filename} (ID: {location.id}) not found. Triggering background generation.")

            original_filepath = os.path.join(location.path, location.filename)
            if original_filepath and Path(original_filepath).is_file():
                thread = threading.Thread(
                    target=image_processor.generate_thumbnail_in_background,
                    args=(location.id, img.content_hash, original_filepath, database.main_event_loop)
                )
                thread.daemon = True
                thread.start()
            else:
                print(f"Could not trigger thumbnail generation for {location.filename}: original_filepath not found or invalid.")

        if isinstance(img.exif_data, str):
            try:
                img.exif_data = json.loads(img.exif_data)
            except json.JSONDecodeError:
                img.exif_data = {} # Or handle error appropriately
        
        response_images.append(schemas.ImageContent(
            id=location.id,
            filename=location.filename,
            path=location.path,
            **img.__dict__
        ))
    return response_images

@router.get("/images/{image_id}", response_model=schemas.ImageContent)
def read_image(
        image_id: int,
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(auth.get_current_user)
    ):
    # Retrieves a single image by ID. Accessible by all.
    # Eager loads associated tags and includes paths to generated media.
    # Triggers thumbnail generation if not found.

    location_image = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if location_image is None:
        raise HTTPException(status_code=404, detail="Image location not found")

    db_image = db.query(models.ImageContent).filter(models.ImageContent.content_hash == location_image.content_hash).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image content not found")

    # Check if thumbnail exists, if not, trigger generation in background
    expected_thumbnail_path = os.path.join(config.THUMBNAILS_DIR, f"{db_image.content_hash}_thumb.webp")
    if not os.path.exists(expected_thumbnail_path):
        print(f"Thumbnail for {location_image.filename} (ID: {location_image.id}) not found. Triggering background generation.")
        original_filepath = os.path.join(location_image.path, location_image.filename)
        if original_filepath and Path(original_filepath).is_file():
            thread = threading.Thread(
                target=image_processor.generate_thumbnail_in_background,
                args=(location_image.id, db_image.content_hash, original_filepath, database.main_event_loop)
            )
            thread.daemon = True
            thread.start()
        else:
            print(f"Could not trigger thumbnail generation for {location_image.filename}: original_filepath not found or invalid.")

    if isinstance(db_image.exif_data, str):
        try:
            db_image.exif_data = json.loads(db_image.exif_data)
        except json.JSONDecodeError:
            db_image.exif_data = {}

    return schemas.ImageContent(
        id=location_image.id,
        filename=location_image.filename,
        path=location_image.path,
        **db_image.__dict__
    )

@router.put("/images/{image_id}", response_model=schemas.ImageContent)
def update_image(image_id: int, image_update: schemas.ImageTagUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Updates an existing image's tags.
    # Requires authentication.

    image_location = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if image_location is None:
        raise HTTPException(status_code=404, detail="Image location not found")

    db_image = db.query(models.ImageContent).filter(models.ImageContent.content_hash == image_location.content_hash).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image content not found")

    if image_update.tag_ids is not None:
        db_image.tags.clear()
        for tag_id in image_update.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_image.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found.")
    
    db.commit()
    db.refresh(db_image)
    return read_image(image_id, db)

@router.post("/images/{image_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def mark_image_as_deleted(
    image_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Marks an image location as deleted by setting its 'deleted' flag to True.
    This is a "soft delete".
    """
    image_location = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if image_location is None:
        raise HTTPException(status_code=404, detail="Image location not found")

    image_location.deleted = True
    db.commit()

    # Broadcast a websocket message to remove the image from all connected clients' views.
    if database.main_event_loop:
        message = {"type": "image_deleted", "image_id": image_id}
        # Use run_coroutine_threadsafe because we are in a synchronous FastAPI route
        # calling an asynchronous function in the main event loop.
        asyncio.run_coroutine_threadsafe(manager.broadcast_json(message), database.main_event_loop)
        print(f"Sent 'image_deleted' notification for image ID {image_id}")
    else:
        print("Warning: Could not get main event loop to broadcast WebSocket message for image deletion.")
    return

@router.post("/images/{image_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_image(
    image_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Restores a soft-deleted image by setting its 'deleted' flag to False.
    """
    image_location = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if image_location is None:
        raise HTTPException(status_code=404, detail="Image location not found")

    image_location.deleted = False
    db.commit()

    # Broadcast a generic refresh message. Clients can refetch to see the restored image.
    if database.main_event_loop:
        message = {"type": "refresh_images", "reason": "image_restored", "image_id": image_id}
        asyncio.run_coroutine_threadsafe(manager.broadcast_json(message), database.main_event_loop)
        print(f"Sent 'image_restored' notification for image ID {image_id}")
    return

@router.delete("/images/{image_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_image(
    image_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Permanently deletes a single image from the disk and the database.
    This action is irreversible and restricted to admins.
    """
    if not current_user.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can permanently delete images.")

    image_location = db.query(models.ImageLocation).filter(models.ImageLocation.id == image_id).first()
    if image_location is None:
        raise HTTPException(status_code=404, detail="Image location not found")

    # Delete the physical file
    full_path = os.path.join(image_location.path, image_location.filename)
    try:
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"Permanently deleted file: {full_path}")
    except OSError as e:
        print(f"Error deleting file {full_path}: {e}")
        # We can choose to continue and delete the DB record anyway, or raise an error.
        # For now, we'll raise an error to alert the admin.
        raise HTTPException(status_code=500, detail=f"Failed to delete the physical file: {e}")

    # Delete the database record
    db.delete(image_location)
    db.commit()

    # The 'image_deleted' websocket message is already handled by the frontend, so we can reuse it.
    if database.main_event_loop:
        message = {"type": "image_deleted", "image_id": image_id}
        asyncio.run_coroutine_threadsafe(manager.broadcast_json(message), database.main_event_loop)
        print(f"Sent 'image_deleted' (permanent) notification for image ID {image_id}")
    return

@router.get("/trash/info", response_model=schemas.TrashInfo)
def get_trash_info(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns the number of items currently in the trash.
    """
    count = db.query(func.count(models.ImageLocation.id)).filter(models.ImageLocation.deleted == True).scalar()
    return {"item_count": count}

@router.post("/trash/empty", status_code=status.HTTP_204_NO_CONTENT)
def empty_trash(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Permanently deletes all images that are marked as 'deleted' (soft-deleted).
    This involves deleting the physical files and the database records.
    """
    if not current_user.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can empty the trash.")

    trashed_locations = db.query(models.ImageLocation).filter(models.ImageLocation.deleted == True).all()

    if not trashed_locations:
        return # Nothing to do

    for location in trashed_locations:
        full_path = os.path.join(location.path, location.filename)
        try:
            if os.path.exists(full_path):
                os.remove(full_path)
                print(f"Permanently deleted file: {full_path}")
        except OSError as e:
            print(f"Error deleting file {full_path}: {e}")
            # Decide if you want to stop or continue. For now, we continue.
        
        db.delete(location)
    
    db.commit()
    return

@router.get("/images/original/{checksum}", response_class=FileResponse)
async def get_original_image(
    checksum: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protect this endpoint
):
    # Retrieves the original image file using its checksum and filename.
    # This endpoint uses FileResponse to serve files directly from their disk path.

    db_image = db.query(models.ImageLocation).filter(models.ImageLocation.content_hash == checksum).first()

    full_path = os.path.join(db_image.path, db_image.filename)

    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found in database for the given checksum.")

    try:
        if not os.path.exists(db_image.path) or not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Original image file not found on disk or path is invalid.")

        # Determine media type dynamically
        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            mime_type = "application/octet-stream" # Fallback if MIME type cannot be guessed

        return FileResponse(full_path, media_type=mime_type)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Image metadata is corrupted.")
    except Exception as e:
        print(f"Error serving original image {checksum}/{db_image.filename}: {e}")
        raise HTTPException(status_code=500, detail="Error serving image.")