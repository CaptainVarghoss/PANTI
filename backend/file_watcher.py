import asyncio
import json
import os
import threading
from typing import Dict, List

from sqlalchemy.orm import Session
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

import database
import image_processor
import models
import config
from websocket_manager import manager

def get_watched_paths(db: Session) -> List[str]:
    """Fetches all directory paths from the ImagePath table."""
    print("File Watcher: Fetching paths to watch from database.")
    return [p.path for p in db.query(models.ImagePath).filter(models.ImagePath.ignore == False).all()]


class ImageChangeEventHandler(FileSystemEventHandler):
    """Handles file system events and notifies clients via WebSockets."""

    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    def _get_db(self):
        """Provides a database session for the event handler.
        A new session is created for each event to ensure thread safety."""
        return database.SessionLocal()

    def _is_supported_media(self, path: str) -> bool:
        """Check if the file is a supported media type."""
        return image_processor.is_supported_media(path)

    def _schedule_broadcast(self, message: Dict):
        """Safely schedules a broadcast on the main asyncio event loop."""
        asyncio.run_coroutine_threadsafe(manager.broadcast_json(message), self.loop)

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported_media(event.src_path):
            print(f"File Watcher: Created {event.src_path}")
            db = self._get_db()
            try:
                # Use the new abstracted function to add the file to the DB
                new_image = image_processor.add_file_to_db(db, event.src_path)
                if new_image:
                    db.commit()
                    db.refresh(new_image)
                    print(f"File Watcher: Added new image to DB with ID {new_image.id}")

                    # Get thumb_size from config for background processing
                    thumb_size = config.THUMBNAIL_SIZE

                    # Start thumbnail generation in a background thread
                    thread = threading.Thread(
                        target=image_processor.generate_thumbnail_in_background,
                        args=(new_image.id, new_image.checksum, event.src_path, thumb_size),
                        daemon=True
                    )
                    thread.start()

                    self._schedule_broadcast({"event": "created", "path": event.src_path})
            except Exception as e:
                print(f"File Watcher: Error processing created file {event.src_path}: {e}")
                db.rollback()
            finally:
                db.close()

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            print(f"File Watcher: Deleted {event.src_path}")
            db = self._get_db()
            try:
                image_to_delete = db.query(models.Image).filter(
                    models.Image.path == os.path.dirname(event.src_path),
                    models.Image.filename == os.path.basename(event.src_path)
                ).first()

                if image_to_delete:
                    checksum = image_to_delete.checksum
                    print(f"File Watcher: Deleting image from DB with ID {image_to_delete.id}")
                    db.delete(image_to_delete)
                    db.commit()

                    # Also delete thumbnail and preview files
                    thumb_path = config.THUMBNAILS_DIR / f"{checksum}_thumb.webp"
                    if thumb_path.exists():
                        os.remove(thumb_path)
                        print(f"File Watcher: Deleted thumbnail {thumb_path}")

                    preview_path = config.PREVIEWS_DIR / f"{checksum}_preview.webp"
                    if preview_path.exists():
                        os.remove(preview_path)
                        print(f"File Watcher: Deleted preview {preview_path}")

                    self._schedule_broadcast({"event": "deleted", "path": event.src_path})
            except Exception as e:
                print(f"File Watcher: Error processing deleted file {event.src_path}: {e}")
                db.rollback()
            finally:
                db.close()

    def on_moved(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported_media(event.dest_path):
            print(f"File Watcher: Moved {event.src_path} to {event.dest_path}")
            db = self._get_db()
            try:
                image_to_move = db.query(models.Image).filter(
                    models.Image.path == os.path.dirname(event.src_path),
                    models.Image.filename == os.path.basename(event.src_path)
                ).first()

                if image_to_move:
                    new_dir, new_filename = os.path.split(event.dest_path)
                    print(f"File Watcher: Updating path for image ID {image_to_move.id}")
                    image_to_move.path = new_dir
                    image_to_move.filename = new_filename
                    db.commit()
                    self._schedule_broadcast({"event": "moved", "from_path": event.src_path, "to_path": event.dest_path})
            except Exception as e:
                print(f"File Watcher: Error processing moved file {event.src_path}: {e}")
                db.rollback()
            finally:
                db.close()


def start_file_watcher(loop: asyncio.AbstractEventLoop):
    """
    This function runs in a separate thread and monitors file system changes.
    """
    print("File watcher thread started.")
    db = database.SessionLocal()
    try:
        paths_to_watch = get_watched_paths(db)
    finally:
        db.close()

    if not paths_to_watch:
        print("File Watcher: No paths configured to watch.")
        return

    event_handler = ImageChangeEventHandler(loop)
    observer = Observer()

    for path in paths_to_watch:
        if os.path.exists(path):
            print(f"File Watcher: Watching directory '{path}'")
            observer.schedule(event_handler, path, recursive=True)
        else:
            print(f"File Watcher: Path '{path}' does not exist. Skipping.")

    observer.start()
    print("File watcher is running.")
    observer.join() # This will block until the observer is stopped.
    print("File watcher has stopped.")
