from app.models import db, Image
import time, os, hashlib, fcntl
from PIL import Image as Pimage
from app.routes.settings import get_settings
import datetime, magic, subprocess

class ImageHandler():
    def __init__(self, file_path, filename, lock_dir="/tmp/file_watcher_locks"):
        self.settings = get_settings()
        self.file_path = file_path
        self.filename = filename
        self.checksum = self.get_checksum()
        self.mime = self.get_mime_type()
        self.is_video = True if self.mime == 'video' else False
        self.date_created = self.get_created_date()
        self.thumb_path = 'app/static/thumbnails/'
        self.timer = None
        self.debounce_delay = 1.0
        self.lock_dir = lock_dir  # Directory for lock files
        os.makedirs(self.lock_dir, exist_ok=True)  # Ensure lock directory exists

    def get_mime_type(self):
        mime = magic.from_file(os.path.join(self.file_path, self.filename), mime=True)
        mime_parts = mime.split("/")
        return mime_parts[0]

    def get_checksum(self):
        with open(os.path.join(self.file_path, self.filename), 'rb') as file_to_check:
            data = file_to_check.read()
            return hashlib.sha256(data).hexdigest()

    def db_add_image(self):
        lock_path = os.path.join(self.lock_dir, f"{self.filename}.lock")
        lock_file = None
        try:
            existing_image = self.db_get_image()
            if not existing_image:
                try:
                    # Attempt to acquire an exclusive lock
                    lock_file = open(lock_path, 'w')
                    fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)  # Non-blocking
                    print(f"Lock acquired: {lock_path}")
                    try:
                        if not self.is_video:
                            meta = self.get_meta()
                        else:
                            meta = {}
                        new_image = Image(filename=self.filename, checksum=self.checksum, path=self.file_path, meta=meta, date_created=self.date_created, is_video=self.is_video)
                        db.session.add(new_image)
                        db.session.commit()
                        print(f'Image: {self.filename} added to database. ID: {new_image.id}')
                        ## send new image to clients
                        from app.views import send_update
                        #send_update()
                        return new_image.id
                    except Exception as e:
                        print(f'Error adding image to database: {e}')
                    finally:
                        if lock_file:
                            fcntl.flock(lock_file, fcntl.LOCK_UN)  # Release the lock
                            lock_file.close()
                            os.remove(lock_path)  # Clean up the lock file
                            print(f"Lock released and removed: {lock_path}")
                except BlockingIOError:
                    print(f"File is locked, skipping processing: {os.path.join(self.file_path, self.filename)}")
                    if lock_file:
                        lock_file.close()
                except Exception as e:
                    print(f"Error handling file: {e}")
                    if lock_file:
                        lock_file.close()

            else:
                # If the image exists, we don't need to lock or add
                pass
            self.check_thumbnail()
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            if lock_file:
                lock_file.close()

    def db_add_video(self):
        return

    def db_get_image(self):
        image = Image.query.filter_by(checksum=self.checksum).first()
        if image:
            return image
        else:
            return False

    def get_meta(self):
        image = Pimage.open(os.path.join(self.file_path, self.filename))
        exif = image.info
        exif['width'] = image.width
        exif['height'] = image.height
        return exif

    def get_created_date(self):
        file_date = os.path.getctime(os.path.join(self.file_path, self.filename))
        date_created = datetime.datetime.fromtimestamp(file_date)
        return date_created

    def check_thumbnail(self):
        if not os.path.exists(os.path.join(self.thumb_path, f'{self.checksum}.webp')):
            self.generate_thumbnail()

    def generate_thumbnail(self):
        print('Generating thumbnail')
        if os.path.exists(self.thumb_path):
            if self.mime == 'video':
                temp_image = os.path.join(self.thumb_path, f'{self.filename}_temp.png')
                command = [
                    'ffmpeg',
                    '-i', os.path.join(self.file_path, self.filename),
                    '-ss', '00:00:00',
                    '-vframes', '1',
                    temp_image
                ]
                print("FFmpeg Command:", command)  # Add this line
                try:
                    subprocess.run(command, check=True, capture_output=True)
                except subprocess.CalledProcessError as e:
                    print(f"FFmpeg Error (status {e.returncode}): {e}")
                    print(f"FFmpeg stderr:\n{e.stderr.decode()}")
                    return False
                image = Pimage.open(temp_image)
            elif self.mime == 'image':
                image = Pimage.open(os.path.join(self.file_path, self.filename))
            else:
                return
            image.thumbnail((int(get_settings('thumb_size')) + 100,int(get_settings('thumb_size')) + 100))
            image.save(os.path.join(self.thumb_path, f'{self.checksum}.webp'), 'webp')
            if self.mime == 'video':
                #delete temp video thumbnail
                os.remove(temp_image)
            print('Thumbnail generated for ' + self.filename)
        else:
            print('Path broken')


