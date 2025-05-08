from app.models import db, Image
from flask import json
import time, os, hashlib, fcntl
from PIL import Image as Pimage
from app.settings import get_settings

# Build the modal with tag form and list and metadata
# Handles general 'get' as well as 'add' and 'del' for tags



def string_to_nested_dict(json_string):
    """
    Converts a JSON string to a Python dictionary and recursively
    processes nested dictionaries.

    Args:
        json_string (str): The JSON string to convert.

    Returns:
        dict or None: The Python dictionary representation of the string,
                     or None if the string cannot be parsed as JSON.
    """
    try:
        data = json.loads(json_string)
        return process_nested_dict(data)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON string: {json_string}")
        return None

def process_nested_dict(data):
    """
    Recursively loops through a dictionary and its nested dictionaries.

    Args:
        data (dict): The dictionary to process.

    Returns:
        dict: The (potentially modified) dictionary after processing.
              In this example, it returns the original dictionary.
              You can modify this function to perform actions on the data.
    """
    for key, value in data.items():
        # You can perform actions on each key-value pair here
        print(f"Processing key: {key}, value: {value} (Type: {type(value)})")

        if isinstance(value, dict):
            print(f"Found nested dictionary for key: {key}")
            process_nested_dict(value)  # Recursive call for nested dictionary
        elif isinstance(value, list):
            print(f"Found list for key: {key}")
            process_nested_list(value)

    return data  # Return the (potentially modified) dictionary

def process_nested_list(data_list):
    """
    Recursively loops through a list and processes its elements,
    handling nested dictionaries and lists.

    Args:
        data_list (list): The list to process.
    """
    for item in data_list:
        print(f"Processing list item: {item} (Type: {type(item)})")
        if isinstance(item, dict):
            print("Found nested dictionary in list:")
            process_nested_dict(item)
        elif isinstance(item, list):
            print("Found nested list in list:")
            process_nested_list(item)


def scan_files(folder=""):
    if folder == "":
        folder = get_settings('base_path')
    scan_time = time.perf_counter()
    print("Scanning files..")
    if os.path.exists(folder):
        #build file and dir lists
        file_list = []
        dir_list = []
        file_count = 0
        dir_count = 0
        full_list = os.listdir(folder)
        for f in full_list:
            if os.path.isfile(folder + f):
                file_count += 1
                file_list.append(f)
            elif not os.path.isfile(folder + f):
                dir_count += 1
                dir_list.append(f)
            else:
                print('not file or folder?')
        # now check database for files
        if file_list:
            for f in file_list:
                f_file = ImageHandler(file_path=folder, filename=f)
                import magic
                mime = magic.from_file(os.path.join(folder, f), mime=True)
                mime = mime.split("/")
                if mime == 'image':
                    if f_file.db_get_image():
                        f_file.check_thumbnail()
                    else:
                        f_file.db_add_image()
                        f_file.check_thumbnail()
                elif mime == 'video':
                    print('Video file found, add support for videos!')

        end_time = time.perf_counter()
        scan_time = end_time - scan_time
        print(f'Scan completed in {scan_time:.3f} seconds. Counted {file_count} images and {dir_count} directories.')
    else:
        print('Base Path does not exist at: ' + folder)


class ImageHandler():
    def __init__(self, file_path, filename, lock_dir="/tmp/file_watcher_locks"):
        #self.mime = self.get_mime_type()
        self.settings = get_settings()
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
        #if self.mime:
            lock_path = self._get_lock_path(self.filename)
            lock_file = None
            try:
                # Attempt to acquire an exclusive lock
                lock_file = open(lock_path, 'w')
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)  # Non-blocking
                print(f"Lock acquired: {lock_path}")
                try:
                    meta = self.get_meta()
                    try:
                        existing_image = self.db_get_image()
                        if existing_image:
                            print('Image exists, fail quietly.')
                            return
                        else:
                            new_image = Image(filename=self.filename, checksum=self.checksum, path=self.file_path, meta=meta)
                            db.session.add(new_image)
                            db.session.commit()
                            print(f'Image: {self.filename} added to database. ID: {new_image.id}')
                            ## send new image to clients
                            #from main import send_new_image
                            #send_new_image({'filename': url_for('image_handler.send_media', filename=self.filename), 'checksum': url_for('static', filename='thumbnails/' + self.checksum + '.webp'), 'id': url_for('image_handler.image_info', id=new_image.id)})
                            return new_image.id
                    except Exception as e:
                        print(f'Error adding image to database: {e}')
                except Exception as e:
                    print(f"Error processing image: {e}")
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


