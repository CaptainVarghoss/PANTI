import os
import hashlib
import mimetypes
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from typing import Tuple
import threading

import models
import database
import config
import image_processor

# Define supported image and video MIME types
# This list can be expanded based on your needs
SUPPORTED_MEDIA_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    'image/heic', # Common for iPhones
    'image/heif', # Common for iPhones
}

def get_file_checksum(filepath: str, block_size=65536):
    """Calculates the SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            for block in iter(lambda: f.read(block_size), b''):
                sha256.update(block)
        return sha256.hexdigest()
    except Exception as e:
        print(f"Error calculating checksum for {filepath}: {e}")
        return None

def is_supported_media(filepath: str):
    """Checks if a file is a supported image or video based on its MIME type."""
    mime_type, _ = mimetypes.guess_type(filepath)
    return mime_type and mime_type in SUPPORTED_MEDIA_TYPES

def parse_size_setting(size_str: str) -> Tuple[int, int]:
    """Parses a comma-separated string 'width,height' into an integer tuple."""
    try:
        parts = [int(p.strip()) for p in size_str.split(',')]
        if len(parts) == 1: # Handle single value (e.g., "400" for 400x400)
            return (parts[0], parts[0])
        elif len(parts) == 2:
            return (parts[0], parts[1])
    except (ValueError, AttributeError):
        pass # Fall through to default if parsing fails
    print(f"Warning: Could not parse size setting '{size_str}'. Using default from config.")
    # Fallback to a reasonable default if parsing fails
    return (400, 400) # Default for thumb, or (1024,1024) for preview depending on context

def process_and_update_image(
    image_id: int,
    original_filepath: str,
    db_session: Session,
    thumbnail_size: Tuple[int, int], # New argument
    preview_size: Tuple[int, int]    # New argument
):
    """
    Generates thumbnails/previews for an image and updates its metadata in the DB.
    This function should be run in a separate thread/process to avoid blocking.
    """
    print(f"Processing image {image_id}: {original_filepath}")

    unique_name_base = str(image_id)

    generated_urls = image_processor.generate_image_versions(
        source_filepath=original_filepath,
        output_filename_base=unique_name_base,
        thumbnail_size=thumbnail_size, # Pass dynamic sizes
        preview_size=preview_size    # Pass dynamic sizes
    )

    if generated_urls:
        try:
            db_image = db_session.query(models.Image).filter(models.Image.id == image_id).first()
            if db_image:
                current_meta = json.loads(db_image.meta) if db_image.meta else {}
                current_meta.update(generated_urls)
                db_image.meta = json.dumps(current_meta)
                db_session.commit()
                print(f"Updated metadata for image {image_id} with generated URLs.")
            else:
                print(f"Error: Image with ID {image_id} not found for metadata update.")
        except Exception as e:
            db_session.rollback()
            print(f"Error updating image {image_id} metadata in DB: {e}")
    else:
        print(f"No generated URLs for image {image_id}. Skipping metadata update.")

def scan_paths(db: Session):
    # Scans all paths in the ImagePath table for new images/videos and subdirectories.
    # Adds new media to Image table and new subdirectories to ImagePath table.
    print(f"[{datetime.now().isoformat()}] Starting file scan...")

    # --- Fetch dynamic sizes from settings ---
    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()

    dynamic_thumbnail_size = config.THUMBNAIL_SIZE # Fallback to config default
    dynamic_preview_size = config.PREVIEW_SIZE     # Fallback to config default

    if thumb_size_setting and thumb_size_setting.value:
        parsed_thumb_size = parse_size_setting(thumb_size_setting.value)
        if parsed_thumb_size:
            dynamic_thumbnail_size = parsed_thumb_size
            print(f"Using dynamic thumbnail size from DB: {dynamic_thumbnail_size}")
        else:
            print(f"Invalid 'thumb_size' setting '{thumb_size_setting.value}' in DB. Using default: {dynamic_thumbnail_size}")

    if preview_size_setting and preview_size_setting.value:
        parsed_preview_size = parse_size_setting(preview_size_setting.value)
        if parsed_preview_size:
            dynamic_preview_size = parsed_preview_size
            print(f"Using dynamic preview size from DB: {dynamic_preview_size}")
        else:
            print(f"Invalid 'preview_size' setting '{preview_size_setting.value}' in DB. Using default: {dynamic_preview_size}")

    # Get the list of paths to scan from the database
    paths_to_scan = db.query(models.ImagePath).all()
    # Fetch all existing image paths from the database
    existing_image_paths = {p.path for p in db.query(models.ImagePath).all()}
    # Fetch all existing image checksums to avoid duplicates
    existing_image_checksums = {img.checksum for img in db.query(models.Image).all()}

    new_images_to_process = []
    new_subdirectories_found = 0

    for image_path_entry in paths_to_scan:
        current_path = image_path_entry.path
        if not os.path.isdir(current_path):
            print(f"Warning: Configured path '{current_path}' does not exist or is not a directory. Skipping.")
            continue

        print(f"Scanning directory: {current_path}")
        for root, dirs, files in os.walk(current_path):
            # Add new subdirectories to ImagePath table
            for d in dirs:
                subdir_full_path = os.path.join(root, d)
                if subdir_full_path not in existing_image_paths:
                    print(f"Found new subdirectory: {subdir_full_path}")
                    new_image_path = models.ImagePath(
                        path=subdir_full_path,
                        parent=root, # Set parent to the immediate parent directory
                        description=f"Auto-added: {d}",
                        ignore=False,
                        admin_only=False,
                        basepath=False, # auto-added are NOT basepath
                        built_in=False
                    )
                    db.add(new_image_path)
                    existing_image_paths.add(subdir_full_path) # Add to set to prevent duplicates in current scan
                    new_subdirectories_found += 1

            # Add new images/videos to Image table
            for f in files:
                file_full_path = os.path.join(root, f)
                if is_supported_media(file_full_path):
                    checksum = get_file_checksum(file_full_path)
                    if checksum and checksum not in existing_image_checksums:
                        print(f"Found new media file: {file_full_path}")
                        mime_type, _ = mimetypes.guess_type(file_full_path)
                        is_video = mime_type and mime_type.startswith('video/')

                        initial_meta = {
                            "original_filepath": file_full_path,
                            "mime_type": mime_type,
                            "is_video": is_video,
                            "original_filename": f,
                            "original_path": root
                        }

                        new_image = models.Image(
                            checksum=checksum,
                            filename=f,
                            path=root,
                            meta=json.dumps(initial_meta),
                            date_created=func.now(),
                            date_modified=func.now(),
                            is_video=is_video
                        )
                        db.add(new_image)
                        existing_image_checksums.add(checksum) # Add to set to prevent duplicates in current scan
                        new_images_to_process.append((new_image, file_full_path))
                else:
                    # Optional: Print ignored files for debugging
                    print(f"Ignoring unsupported file: {file_full_path}")

    try:
        db.commit()
        print(f"[{datetime.now().isoformat()}] File scan database commit completed. Added {len(new_images_to_process)} new media files and {new_subdirectories_found} new subdirectories.")

        if new_images_to_process:
            print(f"Triggering background image processing for {len(new_images_to_process)} new images...")
            for new_img_model, original_filepath in new_images_to_process:
                db.refresh(new_img_model)
                thread_db_for_processing = database.SessionLocal()
                try:
                    process_thread = threading.Thread(
                        target=process_and_update_image,
                        args=(new_img_model.id, original_filepath, thread_db_for_processing,
                              dynamic_thumbnail_size, dynamic_preview_size) # Pass dynamic sizes
                    )
                    process_thread.daemon = True
                    process_thread.start()
                except Exception as e:
                    print(f"Failed to start processing thread for image {new_img_model.id}: {e}")
                    thread_db_for_processing.close()

    except Exception as e:
        db.rollback()
        print(f"[{datetime.now().isoformat()}] Error during file scan database commit/processing initiation: {e}")

