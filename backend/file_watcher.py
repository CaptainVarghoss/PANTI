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
import schemas
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
            image_path = os.path.dirname(event.src_path)
            try:
                # Find the corresponding ImagePath entry to check its admin_only status.
                # This is crucial for determining who should receive the websocket notification.
                image_path_entry = db.query(models.ImagePath).filter(models.ImagePath.path == image_path).first()
                if not image_path_entry:
                    # This can happen if a file is added to a directory that is not yet tracked in the DB.
                    # The main periodic scanner will pick it up later.
                    print(f"File Watcher: Skipping file in untracked path: {event.src_path}")
                    return

                # Get existing checksums to avoid redundant DB queries in add_file_to_db
                existing_checksums = {row[0] for row in db.query(models.ImageContent.content_hash).all()}
                
                # Add the file to the DB. Pass the loop and path entry so it can handle the broadcast.
                image_processor.add_file_to_db(
                    db, event.src_path, existing_checksums, image_path_entry, self.loop
                )
                # The commit is handled within add_file_to_db
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
                # We are deleting an ImageLocation, not the content itself.
                location_to_delete = db.query(models.ImageLocation).filter(
                    models.ImageLocation.path == os.path.dirname(event.src_path),
                    models.ImageLocation.filename == os.path.basename(event.src_path)
                ).first()

                if location_to_delete:
                    image_id = location_to_delete.id
                    print(f"File Watcher: Deleting image location from DB with ID {image_id}")
                    db.delete(location_to_delete)
                    db.commit()

                    # Broadcast a generic deletion message to all clients.
                    message = {"type": "image_deleted", "image_id": image_id}
                    self._schedule_broadcast(message)
                    print(f"Sent 'image_deleted' notification for image ID {image_id}")
            except Exception as e:
                print(f"File Watcher: Error processing deleted file {event.src_path}: {e}")
                db.rollback()
            finally:
                db.close()

    def on_moved(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported_media(event.dest_path):
            print(f"File Watcher: Moved/Renamed {event.src_path} to {event.dest_path}")
            db = self._get_db()
            try:
                # Find the ImageLocation entry for the source path
                location_to_move = db.query(models.ImageLocation).filter(
                    models.ImageLocation.path == os.path.dirname(event.src_path),
                    models.ImageLocation.filename == os.path.basename(event.src_path)
                ).first()

                if location_to_move:
                    new_dir, new_filename = os.path.split(event.dest_path)
                    print(f"File Watcher: Updating path for image location ID {location_to_move.id}")
                    location_to_move.path = new_dir
                    location_to_move.filename = new_filename
                    db.commit()
                    # A 'moved' event could be complex on the frontend. For now, we can treat it
                    # as a deletion of the old and creation of a new one, or just refetch.
                    # A simple approach is to just notify clients that something changed.
                    # A more advanced implementation would send both old and new data.
                    # For now, we will not broadcast a specific message for 'moved'. The frontend will catch up on refresh.
            except Exception as e:
                print(f"File Watcher: Error processing moved file {event.src_path}: {e}")
                db.rollback()
            finally:
                db.close()


def start_file_watcher(loop: asyncio.AbstractEventLoop):
    # This function runs in a separate thread and monitors file system changes.
    
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
