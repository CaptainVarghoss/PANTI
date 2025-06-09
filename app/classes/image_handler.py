from app.models import db, Image
import os, hashlib
from PIL import Image as Pimage
from app.routes.settings import get_settings
import datetime, magic
#import subprocess
import shlex, time
from gevent.threadpool import ThreadPool

# Initialize global threadpool
cpu_bound_pool = ThreadPool(maxsize=os.cpu_count() or 4)

class ImageHandler():
    def __init__(self, file_path, filename, app_instance):
        if app_instance is not None:
            self.app = app_instance
        else:
            from flask import current_app
            self.app = current_app._get_current_object()

        self.settings = get_settings()
        self.file_path = file_path
        self.filename = filename
        self.full_file_path = os.path.join(self.file_path, self.filename)
        if not os.path.exists(self.full_file_path):
            raise FileNotFoundError(f"File not found: {self.full_file_path}")
        self.checksum = self._call_cpu_bound(self._get_checksum_internal, self.app)
        self.mime = self._call_cpu_bound(self._get_mime_type_internal, self.app)
        self.is_video = self.mime.startswith('video')
        self.date_created = self._call_cpu_bound(self._get_created_date_internal, self.app)
        self.thumb_path = 'app/static/thumbnails/'

    def _call_cpu_bound(self, func, app_instance, *args, **kwargs):
        return cpu_bound_pool.spawn(func, app_instance, *args, **kwargs).get()

    def _get_mime_type_internal(self, app):
        with app.app_context():
        # Use a try-except block here as magic.from_file can fail on incomplete files
            try:
                mime = magic.from_file(self.full_file_path, mime=True)
                mime_parts = mime.split("/")
                return mime_parts[0]
            except Exception as e:
                print(f"Error getting MIME type for {self.full_file_path}: {e}")
                return "unknown" # Return a default or handle appropriately

    def _get_checksum_internal(self, app):
        hasher = hashlib.sha256()
        with open(self.full_file_path, 'rb') as file_to_check:
            buf = file_to_check.read(65536) # Read in 64KB chunks
            while len(buf) > 0:
                hasher.update(buf)
                buf = file_to_check.read(65536)
        return hasher.hexdigest()


    def db_add_image(self):
        # Adds a new image record to the database if it doesn't already exist
        # Returns a status string: 'created', 'skipped_exists', 'skipped_locked', 'error'.
        # Also returns image ID
        status = 'error' # Default status in case of unhandled exception
        image_id = None

        existing_image = self.db_get_image() # Check for existence based on checksum
        if not existing_image:
            meta = {}

            new_image = Image(
                filename=self.filename,
                checksum=self.checksum,
                path=self.file_path,
                meta=meta,
                date_created=self.date_created,
                is_video=self.is_video
            )
            db.session.add(new_image)
            db.session.commit()
            print(f'Image: {self.filename} added to database. ID: {new_image.id}')
            status = 'created' # Image was successfully created
            image_id = new_image.id

        else:
            status = 'skipped_exists'
            image_id = existing_image.id

        return status, image_id

    def db_get_image(self):
        return Image.query.filter_by(checksum=self.checksum).first()

    def _get_meta_internal(self, app):
        # Use a try-except block for PIL operations
        try:
            image = Pimage.open(self.full_file_path)
            exif = dict(image.info)
            exif['width'] = image.width
            exif['height'] = image.height
            image.close() # Good practice to close the image
            return exif
        except Exception as e:
            print(f"Error getting metadata for {self.full_file_path}: {e}")
            return {}

    def get_and_update_meta(self):
        # Get metadata and update the database record.
        image_record = self.db_get_image() # Retrieve the current image record
        if image_record:
            if image_record.meta == '':
                # Generate metadata using the CPU-bound pool
                new_meta = self._call_cpu_bound(self._get_meta_internal, self.app)
                if new_meta: # Only update if metadata was successfully extracted
                    image_record.meta = new_meta
                    db.session.add(image_record) # Re-add to session to mark as modified
                    db.session.commit()
                    print(f"Metadata updated for {self.filename}")
                    return True
        print(f"Could not update metadata for {self.filename}")
        return False

    def _get_created_date_internal(self, app):
        try:
            # os.path.getctime gives creation time on Windows, last metadata change on Unix
            # os.path.getmtime gives last modification time
            file_date_timestamp = os.path.getctime(self.full_file_path)
            return datetime.datetime.fromtimestamp(file_date_timestamp)
        except Exception as e:
            print(f"Error getting creation date for {self.full_file_path}: {e}")
            return datetime.datetime.now() # Fallback