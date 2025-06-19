from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, not_
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import os, json, threading, mimetypes

import auth
import database
import models
import schemas
import config
import image_processor

router = APIRouter()

# --- Image Endpoints ---

@router.post("/images/", response_model=schemas.Image, status_code=status.HTTP_201_CREATED)
def create_image(image: schemas.ImageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Creates a new image entry in the database.
    # FIX THIS
    # Probably not needed at all unless tied to uploads or similar

    db_image = models.Image(
        checksum=image.checksum,
        filename=image.filename,
        path=image.path,
        meta=image.meta,
        is_video=image.is_video
    )
    for tag_id in image.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_image.tags.append(tag)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

@router.get("/images/", response_model=List[schemas.Image])
def read_images(
    limit: int = 100,
    search_query: Optional[str] = Query(None, description="Search term for filename or path"),
    sort_by: str = Query("date_created", description="Column to sort by (e.g., filename, date_created, checksum)"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'"),
    last_id: Optional[int] = Query(None, description="ID of the last item from the previous page for cursor-based pagination"),
    last_sort_value: Optional[str] = Query(None, description="Value of the sort_by column for the last_id item (for stable pagination)"),
    db: Session = Depends(database.get_db)
):
    """
    Retrieves a list of images with support for searching, sorting, and cursor-based pagination.
    Accessible by all. Eager loads associated tags and includes paths to generated media.
    Triggers thumbnail generation if not found.
    """
    query = db.query(models.Image).options(joinedload(models.Image.tags))

    # Apply search filter if provided
    if search_query:
        # Using ilike for case-insensitive search (might require specific DB setup for performance)
        # For SQLite, it's typically case-insensitive by default for ASCII.
        # For more complex needs, consider using SQLAlchemy's `match` or `regexp` (with custom SQLite function).
        query = query.filter(
            or_(
                models.Image.filename.ilike(f"%{search_query}%"),
                models.Image.path.ilike(f"%{search_query}%"),
                models.Image.meta.ilike(f'%{search_query}%')
            )
        )

    # Apply cursor-based pagination (Keyset Pagination)
    if last_id is not None and last_sort_value is not None:
        # Determine the column to sort by
        sort_column = getattr(models.Image, sort_by)

        # Handle type conversion for last_sort_value based on sort_by column's type
        # Especially crucial for `date_created` which is a datetime object
        converted_last_sort_value = last_sort_value
        if sort_by == 'date_created':
            try:
                # Convert ISO string back to datetime for comparison
                converted_last_sort_value = datetime.fromisoformat(last_sort_value.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format for last_sort_value.")
        elif sort_by in ['checksum', 'filename']:
            # These are strings, no special conversion needed
            pass # Keep as string

        if sort_order == 'desc':
            # For descending, we want items where sort_column < last_sort_value
            # OR (sort_column = last_sort_value AND id < last_id)
            query = query.filter(
                or_(
                    sort_column < converted_last_sort_value,
                    and_(sort_column == converted_last_sort_value, models.Image.id < last_id)
                )
            )
        else: # sort_order == 'asc'
            # For ascending, we want items where sort_column > last_sort_value
            # OR (sort_column = last_sort_value AND id > last_id)
            query = query.filter(
                or_(
                    sort_column > converted_last_sort_value,
                    and_(sort_column == converted_last_sort_value, models.Image.id > last_id)
                )
            )

    # Apply sorting
    if sort_order == 'desc':
        query = query.order_by(getattr(models.Image, sort_by).desc(), models.Image.id.desc())
    else: # 'asc'
        query = query.order_by(getattr(models.Image, sort_by).asc(), models.Image.id.asc())

    # Apply limit
    images = query.limit(limit).all()

    # FIX THIS
    # shouldn't need these paths, thumbnail and preview generators can have them instead
    static_path = os.path.join(config.STATIC_FILES_URL_PREFIX, config.GENERATED_MEDIA_DIR_NAME)
    actual_path = os.path.join(config.STATIC_DIR, config.GENERATED_MEDIA_DIR_NAME)
    thumbnails_path = config.THUMBNAILS_DIR_NAME
    previews_path = config.PREVIEWS_DIR_NAME

    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()

    # FIX THIS
    # If database size cannot be found, Set in database from config then use db value
    config_thumbnail_size = config.THUMBNAIL_SIZE
    config_preview_size = config.PREVIEW_SIZE

    thumb_size = 400
    preview_size = 1024

    if thumb_size_setting and thumb_size_setting.value:
        thumb_size = int(thumb_size_setting.value)
    else:
        thumb_size = config_thumbnail_size

    if preview_size_setting and preview_size_setting.value:
        preview_size = int(preview_size_setting.value)
    else:
        preview_size = config_preview_size

    response_images = []
    for img in images:
        # Check if thumbnail exists, if not, trigger generation in background
        # FIX THIS
        # Thumbnail/preview generators should be called and check for themselves
        expected_thumbnail_path = os.path.join(actual_path, thumbnails_path, f"{img.checksum}_thumb.webp")
        if not os.path.exists(expected_thumbnail_path):
            print(f"Thumbnail for {img.filename} (ID: {img.id}) not found. Triggering background generation.")
            # Ensure original_filepath is extracted from meta
            original_filepath = json.loads(img.meta).get("original_filepath") if img.meta else None
            if original_filepath and Path(original_filepath).is_file():
                thread = threading.Thread(
                    target=image_processor.generate_thumbnail_in_background,
                    args=(img.id, img.checksum, original_filepath, thumb_size)
                )
                thread.daemon = True
                thread.start()
            else:
                print(f"Could not trigger thumbnail generation for {img.filename}: original_filepath not found or invalid.")

        img_dict = img.__dict__.copy()
        img_dict.pop('_sa_instance_state', None)
        # Convert meta string back to dict for Pydantic
        if isinstance(img_dict.get('meta'), str):
             try:
                 img_dict['meta'] = json.loads(img_dict['meta'])
             except json.JSONDecodeError:
                 img_dict['meta'] = {}
        elif img_dict.get('meta') is None:
            img_dict['meta'] = {}

        img_dict['static_path'] = static_path
        img_dict['thumbnails_path'] = os.path.join(static_path, thumbnails_path)
        img_dict['previews_path'] = os.path.join(static_path, previews_path)

        response_images.append(schemas.Image(**img_dict))

    return response_images

@router.get("/images/{image_id}", response_model=schemas.Image)
def read_image(image_id: int, db: Session = Depends(database.get_db)):
    # Retrieves a single image by ID. Accessible by all.
    # Eager loads associated tags and includes paths to generated media.
    # Triggers thumbnail generation if not found.

    db_image = db.query(models.Image).options(joinedload(models.Image.tags)).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    # FIX THIS
    # shouldn't need these paths, thumbnail and preview generators can have them instead
    static_path = os.path.join(config.STATIC_FILES_URL_PREFIX, config.GENERATED_MEDIA_DIR_NAME)
    thumbnails_path = os.path.join(static_path, config.THUMBNAILS_DIR_NAME)
    previews_path = os.path.join(static_path, config.PREVIEWS_DIR_NAME)

    # Fetch sizes from settings
    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()

    # FIX THIS
    # If database size cannot be found, Set in database from config then use db value
    config_thumbnail_size = config.THUMBNAIL_SIZE
    config_preview_size = config.PREVIEW_SIZE

    thumb_size = 400
    preview_size = 1024

    if thumb_size_setting and thumb_size_setting.value:
        thumb_size = int(thumb_size_setting.value)
    else:
        thumb_size = config_thumbnail_size

    if preview_size_setting and preview_size_setting.value:
        preview_size = int(preview_size_setting.value)
    else:
        preview_size = config_preview_size

    # Check if thumbnail exists, if not, trigger generation in background
    # FIX THIS
    # Thumbnail/preview generators should be called and check for themselves
    expected_thumbnail_path = os.path.join(thumbnails_path, f"{db_image.checksum}_thumb.webp")
    if not os.path.exists(expected_thumbnail_path):
        print(f"Thumbnail for {db_image.filename} (ID: {db_image.id}) not found. Triggering background generation.")
        original_filepath = json.loads(db_image.meta).get("original_filepath") if db_image.meta else None
        if original_filepath and Path(original_filepath).is_file():
            thread = threading.Thread(
                target=image_processor.generate_thumbnail_in_background,
                args=(db_image.id, db_image.checksum, original_filepath, thumb_size)
            )
            thread.daemon = True
            thread.start()
        else:
            print(f"Could not trigger thumbnail generation for {db_image.filename}: original_filepath not found or invalid.")

    img_dict = db_image.__dict__.copy()
    img_dict.pop('_sa_instance_state', None)
    if isinstance(img_dict.get('meta'), str):
        try:
            img_dict['meta'] = json.loads(img_dict['meta'])
        except json.JSONDecodeError:
            img_dict['meta'] = {}
    elif img_dict.get('meta') is None:
        img_dict['meta'] = {}

    img_dict['static_path'] = static_path
    img_dict['thumbnails_path'] = thumbnails_path
    img_dict['previews_path'] = previews_path

    return schemas.Image(**img_dict)

@router.put("/images/{image_id}", response_model=schemas.Image)
def update_image(image_id: int, image: schemas.ImageUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Updates an existing image.
    # Requires authentication.

    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    for key, value in image.dict(exclude_unset=True, exclude={'tag_ids'}).items():
        setattr(db_image, key, value)

    if image.tag_ids is not None:
        db_image.tags.clear()
        for tag_id in image.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_image.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found.")

    db.commit()
    db.refresh(db_image)
    return read_image(image_id, db)

@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(image_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Deletes an image.
    # FIX THIS
    # Only deletes DB entry, should also handle physical file removal call

    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(db_image)
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

    db_image = db.query(models.Image).filter(models.Image.checksum == checksum).first()

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