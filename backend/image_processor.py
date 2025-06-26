import os
from PIL import Image as PILImage
from pathlib import Path
import os
import hashlib
import mimetypes
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from typing import Tuple
import threading
import subprocess

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

def get_meta(filepath: str):
    if os.path.exists(filepath):
        try:
            image = PILImage.open(filepath)
            exif = dict(image.info)
            #exif['width'] = image.width
            #exif['height'] = image.height
            image.close() # Good practice to close the image
            return exif
        except Exception as e:
            print(f"Error getting metadata for {filepath}: {e}")
            return {}

def process_and_update_image(
    image_id: int,
    image_checksum: str,
    original_filepath: str,
    thumb_size: int
):
    print(f"Processing image {image_id}: {original_filepath}")

    output_filename_base = image_checksum

    generated_urls = image_processor.generate_thumbnail(
        source_filepath=original_filepath,
        output_filename_base=output_filename_base,
        thumb_size=thumb_size,
    )

    if not generated_urls:
        print(f"No generated URLs for image {image_id}. Skipping metadata update.")


def scan_paths(db: Session):
    # Scans all paths in the ImagePath table for new images/videos and subdirectories.
    # Adds new media to Image table and new subdirectories to ImagePath table.
    print(f"[{datetime.now().isoformat()}] Starting file scan...")

    # --- Fetch dynamic sizes from settings ---
    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()

    config_thumbnail_size = config.THUMBNAIL_SIZE # Fallback to config default
    config_preview_size = config.PREVIEW_SIZE     # Fallback to config default

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
                        short_name=f"{d}",
                        ignore=False,
                        admin_only=False,
                        basepath=False, # auto-added are NOT basepath
                        built_in=False
                    )
                    db.add(new_image_path)
                    existing_image_paths.add(subdir_full_path) # Add to set to prevent duplicates in current scan
                    new_subdirectories_found += 1

            # Add new images/videos to Image table
            files.sort(key=lambda fn: os.path.getctime(os.path.join(root, fn)))
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

                        new_meta = get_meta(file_full_path)
                        if new_meta:
                            initial_meta = new_meta

                        creation_timestamp = os.path.getctime(file_full_path)
                        modification_timestamp = os.path.getmtime(file_full_path)
                        date_created_dt = datetime.fromtimestamp(creation_timestamp)
                        date_modified_dt = datetime.fromtimestamp(modification_timestamp)


                        new_image = models.Image(
                            checksum=checksum,
                            filename=f,
                            path=root,
                            meta=json.dumps(initial_meta),
                            date_created=date_created_dt,
                            date_modified=date_modified_dt,
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
                              thumb_size)
                    )
                    process_thread.daemon = True
                    process_thread.start()
                except Exception as e:
                    print(f"Failed to start processing thread for image {new_img_model.id}: {e}")
                    thread_db_for_processing.close()

    except Exception as e:
        db.rollback()
        print(f"[{datetime.now().isoformat()}] Error during file scan database commit/processing initiation: {e}")



def get_file_checksum(filepath: str, block_size=65536):
    # Calculates the SHA256 checksum of a file.
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
    # Checks if a file is a supported image or video based on its MIME type.
    mime_type, _ = mimetypes.guess_type(filepath)
    return mime_type and mime_type in SUPPORTED_MEDIA_TYPES

def generate_thumbnail_in_background(
    image_id: int,
    image_checksum: str,
    original_filepath: str,
    thumb_size: int,
):
    thread_db = database.SessionLocal() # This session is for this background thread
    try:
        print(f"Background: Starting thumbnail generation for image ID {image_id}, checksum {image_checksum}")
        image_processor.generate_thumbnail(
            source_filepath=original_filepath,
            output_filename_base=image_checksum,
            thumb_size=thumb_size
        )
        print(f"Background: Finished thumbnail generation for image ID {image_id}")
    except Exception as e:
        print(f"Background: Error generating thumbnail for image ID {image_id}: {e}")
    finally:
        thread_db.close()

def generate_thumbnail(
    source_filepath: str,
    output_filename_base: str,
    thumb_size: int,
) -> dict:

    generated_urls = {}
    source_path_obj = Path(source_filepath)
    image_to_process = None
    temp_image_path = None

    if not source_path_obj.is_file():
        print(f"Error: Source file not found: {source_filepath}")
        return generated_urls

    # Determine if the file is a video based on its MIME type
    mime_type, _ = mimetypes.guess_type(source_filepath)
    is_video = mime_type and mime_type.startswith('video')

    # FIX THIS
    # Needs proper pathing
    thumbnail_output_dir = Path(str(config.THUMBNAILS_DIR))
    os.makedirs(thumbnail_output_dir, exist_ok=True)
    thumb_filepath = thumbnail_output_dir / f"{output_filename_base}_thumb.webp"

    if is_video:
        try:
            temp_image_path = os.path.join(thumbnail_output_dir, f'{output_filename_base}_thumb.png')
            # Use ffmpeg to generate thumbnail from video
            # -ss 00:00:01: Take a screenshot at 1 second into the video
            # -vframes 1: Take only one frame
            # -vf scale='min(iw,{thumb_size}):min(ih,{thumb_size})': Scale to fit within thumb_size while maintaining aspect ratio
            # -q:v 2: Output quality (2 is good, 1-31, lower is better)
            # -y: Overwrite output file without asking
            ffmpeg_command = [
                'ffmpeg',
                '-i', source_filepath,
                '-ss', '00:00:00.001',
                '-vframes', '1',
                '-vf', f'scale=min(iw\\,{thumb_size}):min(ih\\,{thumb_size}):force_original_aspect_ratio=decrease',
                '-q:v', '2',
                '-y',
                str(temp_image_path)
            ]
            print(f"Running FFmpeg command: {' '.join(ffmpeg_command)}")
            subprocess.run(ffmpeg_command, check=True, capture_output=True)
            generated_urls['thumbnail_url'] = f"{config.STATIC_FILES_URL_PREFIX}/{config.GENERATED_MEDIA_DIR_NAME}/{config.THUMBNAILS_DIR_NAME}/{output_filename_base}_thumb.webp"
            print(f"Generated video thumbnail: {thumb_filepath}")

            image_to_process = PILImage.open(temp_image_path)
        except subprocess.CalledProcessError as e:
            print(f"Error generating video thumbnail with ffmpeg for {source_filepath}: {e}")
            print(f"FFmpeg stdout: {e.stdout.decode()}")
            print(f"FFmpeg stderr: {e.stderr.decode()}")
        except Exception as e:
            print(f"Error executing ffmpeg for {source_filepath}: {e}")
    else:
        image_to_process = PILImage.open(source_filepath)

    try:

        # Generate Thumbnail
        thumb_img = image_to_process.copy()
        thumb_img.thumbnail((thumb_size,thumb_size))
        thumb_filepath = thumbnail_output_dir / f"{output_filename_base}_thumb.webp"
        thumb_img.save(thumb_filepath, "webp")
        thumb_img.close()
        image_to_process.close()
        # FIX THIS
        generated_urls['thumbnail_url'] = f"{config.STATIC_FILES_URL_PREFIX}/{config.GENERATED_MEDIA_DIR_NAME}/{config.THUMBNAILS_DIR_NAME}/{output_filename_base}_thumb.webp"
        print(f"Generated thumbnail: {thumb_filepath}")

    except PILImage.UnidentifiedImageError:
        print(f"Warning: Could not identify image format for {source_filepath}. Skipping image thumbnail generation.")
    except Exception as e:
        print(f"Error generating image thumbnail for {source_filepath}: {e}")

    if (temp_image_path):
        if (os.path.exists(temp_image_path)):
            try:
                os.remove(temp_image_path)
                print(f"Deleted temporary thumbnail file: {temp_image_path}")
            except Exception as e:
                print(f"Error deleting temporary file {temp_image_path}: {e}")

    return generated_urls

def generate_preview_in_background(
    image_id: int,
    image_checksum: str,
    original_filepath: str,
    preview_size: int,
):
    thread_db = database.SessionLocal() # This session is for this background thread
    try:
        print(f"Background: Starting thumbnail generation for image ID {image_id}, checksum {image_checksum}")
        image_processor.generate_preview(
            source_filepath=original_filepath,
            output_filename_base=image_checksum,
            preview_size=preview_size
        )
        print(f"Background: Finished thumbnail generation for image ID {image_id}")
    except Exception as e:
        print(f"Background: Error generating thumbnail for image ID {image_id}: {e}")
    finally:
        thread_db.close()

# FIX THIS
# Functions were split for thumbnails and previews.
# Recombine after restructure?
def generate_preview(
    source_filepath: str,
    output_filename_base: str,
    preview_size: int
) -> dict:

    generated_urls = {}
    source_path_obj = Path(source_filepath)

    if not source_path_obj.is_file():
        print(f"Error: Source file not found: {source_filepath}")
        return generated_urls

    try:
        img = PILImage.open(source_filepath)

        import config

        # FIX THIS
        # Needs proper pathing
        preview_output_dir = Path(str(config.PREVIEWS_DIR))

        os.makedirs(preview_output_dir, exist_ok=True)

        # Generate Preview
        preview_img = img.copy()
        preview_img.thumbnail((preview_size,preview_size))
        preview_filepath = preview_output_dir / f"{output_filename_base}_preview.webp"
        preview_img.save(preview_filepath, "webp")
        # FIX THIS
        generated_urls['preview_url'] = f"{config.STATIC_FILES_URL_PREFIX}/{config.GENERATED_MEDIA_DIR_NAME}/{config.PREVIEWS_DIR_NAME}/{output_filename_base}_preview.webp"
        print(f"Generated preview: {preview_filepath}")

    except PILImage.UnidentifiedImageError:
        print(f"Warning: Could not identify image format for {source_filepath}. Skipping image preview generation.")
    except Exception as e:
        print(f"Error generating image preview for {source_filepath}: {e}")

    return generated_urls