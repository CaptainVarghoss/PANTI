from app.models import db, Image
import time, os, hashlib, fcntl
from PIL import Image as Pimage
from app.settings import get_settings

class ImageHandler():
    def __init__(self, file_path, filename, lock_dir="/tmp/file_watcher_locks"):
        #self.mime = self.get_mime_type()
        self.settings = get_settings()
        self.base_path = self.settings['base_path']
        self.file_path = file_path
        self.filename = filename
        self.checksum = self.get_checksum()
        self.thumb_path = 'app/static/thumbnails/'
        self.timer = None
        self.debounce_delay = 1.0
        self.lock_dir = lock_dir  # Directory for lock files
        os.makedirs(self.lock_dir, exist_ok=True)  # Ensure lock directory exists

    def get_mime_type(self):
        import magic
        mime = magic.from_file(os.path.join(self.file_path, self.filename), mime=True)
        if 'image' in mime:
            return True
        else:
            return False

    def get_checksum(self):
        with open(os.path.join(self.file_path, self.filename), 'rb') as file_to_check:
        # read contents of the file
            data = file_to_check.read()
        # pipe contents of the file through
            return hashlib.md5(data).hexdigest()

    def db_add_image(self):
        lock_path = self._get_lock_path(self.filename)
        lock_file = None
        try:
            meta = self.get_meta()
            existing_image = self.db_get_image()
            if not existing_image:
                try:
                    # Attempt to acquire an exclusive lock
                    lock_file = open(lock_path, 'w')
                    fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)  # Non-blocking
                    print(f"Lock acquired: {lock_path}")
                    try:
                        cleaned_path = self.file_path.replace(self.base_path, '')
                        new_image = Image(filename=self.filename, checksum=self.checksum, path=cleaned_path, meta=meta)
                        db.session.add(new_image)
                        db.session.commit()
                        print(f'Image: {self.filename} added to database. ID: {new_image.id}')
                        ## send new image to clients
                        #from main import send_new_image
                        #send_new_image({'filename': url_for('image_handler.send_media', filename=self.filename), 'checksum': url_for('static', filename='thumbnails/' + self.checksum + '.webp'), 'id': url_for('image_handler.image_info', id=new_image.id)})
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
                # print('Image exists, skipping lock.') # Uncomment if you want this message
                pass
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            if lock_file:
                lock_file.close()

    def _get_lock_path(self, filename):
        # Generates a lock file path from the watched file's path.
        return os.path.join(self.lock_dir, f"{filename}.lock")

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

    def check_thumbnail(self):
        if not os.path.exists(os.path.join(self.thumb_path, f'{self.checksum}.webp')):
            self.generate_thumbnail()

    def generate_thumbnail(self):
        #print('Generating thumbnail')
        if os.path.exists(self.thumb_path):
            image = Pimage.open(os.path.join(self.file_path, self.filename))
            #print(f'Opened image: {os.path.join(self.file_path, self.filename)}')
            image.thumbnail((int(get_settings('thumb_size')) + 100,int(get_settings('thumb_size')) + 100))
            image.save(os.path.join(self.thumb_path, f'{self.checksum}.webp'), 'webp')
            print('Thumbnail generated for ' + self.filename)
        else:
            print('Path broken')


