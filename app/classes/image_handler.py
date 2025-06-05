from app.models import db, Image
import time, os, hashlib
from PIL import Image as Pimage
from app.routes.settings import get_settings
import datetime, magic, subprocess
import portalocker
from portalocker import LockException, AlreadyLocked

class ImageHandler():
    def __init__(self, file_path, filename, lock_dir="/tmp/file_watcher_locks"):
        self.settings = get_settings()
        self.file_path = file_path
        self.filename = filename
        # Ensure full_file_path is always used for file operations
        self.full_file_path = os.path.join(self.file_path, self.filename)
        self.checksum = self.get_checksum()
        self.mime = self.get_mime_type()
        self.is_video = True if self.mime.startswith('video/') else False # More robust check for video mime
        self.date_created = self.get_created_date()
        self.thumb_path = 'app/static/thumbnails/'
        self.lock_dir = lock_dir  # Directory for lock files
        os.makedirs(self.lock_dir, exist_ok=True)  # Ensure lock directory exists

    def get_mime_type(self):
        # Use a try-except block here as magic.from_file can fail on incomplete files
        try:
            mime = magic.from_file(self.full_file_path, mime=True)
            mime_parts = mime.split("/")
            return mime_parts[0]
        except Exception as e:
            print(f"Error getting MIME type for {self.full_file_path}: {e}")
            return "unknown" # Return a default or handle appropriately

    def get_checksum(self):
        # Use a try-except block for file reading
        try:
            with open(self.full_file_path, 'rb') as file_to_check:
                data = file_to_check.read()
                return hashlib.sha256(data).hexdigest()
        except FileNotFoundError:
            print(f"Checksum error: File not found {self.full_file_path}")
            return None
        except Exception as e:
            print(f"Error getting checksum for {self.full_file_path}: {e}")
            return None

    def db_add_image(self):
        # Adds a new image record to the database if it doesn't already exist
        # Returns a status string: 'created', 'skipped_exists', 'skipped_locked', 'error'.
        # Also returns image ID
        lock_path = os.path.join(self.lock_dir, f"{self.checksum}.lock") # Use checksum for lock file to avoid conflicts for same file names
        lock_file = None
        status = 'error' # Default status in case of unhandled exception
        image_id = None

        # First, ensure file exists and checksum could be generated
        if not os.path.exists(self.full_file_path) or self.checksum is None:
            print(f"Skipping db_add_image for {self.full_file_path}: File not found or checksum could not be generated.")
            return 'error', None

        try:
            existing_image = self.db_get_image() # Check for existence based on checksum
            if not existing_image:
                try:
                    # Attempt to acquire an exclusive lock
                    lock_file = open(lock_path, 'w')
                    # Non-blocking lock: if already locked, it raises AlreadyLocked
                    portalocker.lock(lock_file, portalocker.LOCK_EX | portalocker.LOCK_NB)
                    #print(f"Lock acquired: {lock_path}")

                    try:
                        # Re-check for existing image AFTER acquiring lock, in case another process/thread added it
                        # during the short window before lock acquisition. This is a crucial double-check.
                        existing_image_after_lock = self.db_get_image()
                        if existing_image_after_lock:
                            print(f"Image with checksum {self.checksum} found after lock. Skipping add. (Concurrent add?)")
                            status = 'skipped_exists'
                            image_id = existing_image_after_lock.id
                        else:
                            # Proceed with adding the new image
                            if not self.is_video:
                                meta = self.get_meta()
                            else:
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
                            self.check_thumbnail()
                            status = 'created' # Image was successfully created
                            image_id = new_image.id

                    except Exception as e:
                        db.session.rollback() # Rollback in case of DB error
                        print(f'Error adding image to database: {e}')
                        status = 'error'
                    finally:
                        if lock_file:
                            portalocker.unlock(lock_file)  # Release the lock
                            lock_file.close()
                            # It's safer to check if the lock file exists before removing,
                            # especially if cleanup was done by another process on error.
                            if os.path.exists(lock_path):
                                os.remove(lock_path)
                                #print(f"Lock released and removed: {lock_path}")

                except AlreadyLocked:
                    #print(f"File is locked, skipping processing: {self.full_file_path}")
                    status = 'skipped_locked'
                    if lock_file: # Ensure file handle is closed even if lock failed
                        lock_file.close()
                except LockException as e:
                    print(f"Error acquiring lock: {e}")
                    status = 'error'
                    if lock_file:
                        lock_file.close()
                except Exception as e:
                    print(f"Unexpected error during lock/add attempt: {e}")
                    status = 'error'
                    if lock_file:
                        lock_file.close()
            else:
                # If image with this checksum already exists
                # print(f"Image with checksum {self.checksum} already exists. Checking thumbnail.")
                self.check_thumbnail()
                status = 'skipped_exists' # Image already exists, skipped adding
                image_id = existing_image.id
        except Exception as e:
            print(f"An unexpected error occurred in db_add_image: {e}")
            status = 'error'
            if lock_file: # Ensure lock_file is closed if error happened outside inner try/finally
                lock_file.close()

        return status, image_id

    def db_get_image(self):
        image = Image.query.filter_by(checksum=self.checksum).first()
        if image:
            return image
        return False

    def get_meta(self):
        # Use a try-except block for PIL operations
        try:
            image = Pimage.open(self.full_file_path)
            exif = image.info
            exif['width'] = image.width
            exif['height'] = image.height
            image.close() # Good practice to close the image
            return exif
        except FileNotFoundError:
            print(f"Metadata error: File not found {self.full_file_path}")
            return {}
        except Exception as e:
            print(f"Error getting metadata for {self.full_file_path}: {e}")
            return {}

    def get_created_date(self):
        try:
            # os.path.getctime gives creation time on Windows, last metadata change on Unix
            # os.path.getmtime gives last modification time
            file_date_timestamp = os.path.getctime(self.full_file_path)
            return datetime.datetime.fromtimestamp(file_date_timestamp)
        except FileNotFoundError:
            print(f"Creation date error: File not found {self.full_file_path}")
            return datetime.datetime.now() # Fallback to current time
        except Exception as e:
            print(f"Error getting creation date for {self.full_file_path}: {e}")
            return datetime.datetime.now() # Fallback

    def check_thumbnail(self):
        # Ensure thumbnail path exists
        os.makedirs(self.thumb_path, exist_ok=True)
        if not os.path.exists(os.path.join(self.thumb_path, f'{self.checksum}.webp')):
            self.generate_thumbnail()

    def generate_thumbnail(self):
        # Ensure thumbnail path exists before trying to save
        os.makedirs(self.thumb_path, exist_ok=True)

        thumbnail_filepath = os.path.join(self.thumb_path, f'{self.checksum}.webp')
        if os.path.exists(thumbnail_filepath):
            # Thumbnail already exists, no need to regenerate
            print(f"Thumbnail for {self.filename} already exists.")
            return

        # print(f'Generating thumbnail for {self.filename}')
        image_to_process = None
        temp_image_path = None
        try:
            if self.mime.startswith('video'):
                temp_image_path = os.path.join(self.thumb_path, f'{self.checksum}_temp_thumb.png') # Use checksum to avoid filename conflicts
                command = [
                    'ffmpeg',
                    '-i', self.full_file_path,
                    '-ss', '00:00:00.001', # Start a tiny bit into the video for better first frame
                    '-vframes', '1',
                    '-q:v', '2', # Quality setting for output video frame
                    temp_image_path
                ]
                # print("FFmpeg Command:", ' '.join(command))
                process_result = subprocess.run(command, check=False, capture_output=True, text=True) # Set check=False to handle errors manually
                if process_result.returncode != 0:
                    print(f"FFmpeg Error (status {process_result.returncode}) for {self.filename}:")
                    print(f"STDOUT:\n{process_result.stdout}")
                    print(f"STDERR:\n{process_result.stderr}")
                    return False
                image_to_process = Pimage.open(temp_image_path)
            elif self.mime.startswith('image'):
                image_to_process = Pimage.open(self.full_file_path)
            else:
                print(f"Unsupported MIME type for thumbnail generation: {self.mime}")
                return False

            if image_to_process:
                # Convert to RGB to avoid issues with alpha channels/palettes for webp
                if image_to_process.mode in ('RGBA', 'P', 'LA'):
                    image_to_process = image_to_process.convert('RGB')

                thumb_size = int(get_settings('thumb_size')) # Get settings from your app
                image_to_process.thumbnail((thumb_size, thumb_size)) # Keep aspect ratio, scale down
                image_to_process.save(thumbnail_filepath, 'webp', quality=85) # Save as webp with good quality
                image_to_process.close()
                #print(f'Thumbnail generated for {self.filename} at {thumbnail_filepath}')

        except FileNotFoundError:
            print(f"Thumbnail generation error: Source file not found {self.full_file_path}")
            return False
        except Pimage.UnidentifiedImageError:
            print(f"Thumbnail generation error: PIL could not identify image for {self.full_file_path}")
            return False
        except Exception as e:
            print(f"Error during thumbnail generation for {self.full_file_path}: {e}")
            return False
        finally:
            if temp_image_path and os.path.exists(temp_image_path):
                os.remove(temp_image_path)
                print(f"Deleted temporary thumbnail file: {temp_image_path}")