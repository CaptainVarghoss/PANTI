from app.routes.settings import get_settings
from app.__init__ import create_app
from app.models import db
from app.classes.image_handler import ImageHandler
from app.helpers.io_handler import db_check_path
import os, time, magic, threading
from queue import Queue

def startup_scan():
    # Sequential Scan
    #scanner_sequential = ScanFiles()
    #scanner_sequential.scan_folder()

    # Threaded Scan
    scanner_threaded = ScanFiles()
    scanner_threaded.scan_folder_threaded()
    return

class ScanFiles():
    def __init__(self, path=''):
        from main import app
        self.app = app
        self.settings = get_settings()
        #self.settings = settings
        if path == '':
            self.path = self.settings['base_path']
        else:
            self.path = os.path.join(self.settings['base_path'], path)

        if not os.path.exists(self.path):
            print(f'Error: Path does not exist: {self.path}')
            self.file_list = []
            self.file_count = 0
            self.dir_list = []
            self.dir_count = 0
        else:
            self.file_list, self.file_count, self.dir_list, self.dir_count = self._get_file_list()

        self.file_queue = Queue()
        self.dir_queue = Queue()
        self.num_threads = 4 # You can adjust the number of threads

    def scan_folder_threaded(self):
        scan_time = time.perf_counter()
        print(f'Scanning files (threaded): {self.path}..')

        # Add files to the processing queue
        for f in self.file_list:
            self.file_queue.put(f)

        # Create and start file processing threads
        file_threads = []
        for _ in range(self.num_threads):
            thread = threading.Thread(target=self._process_file)
            thread.daemon = True
            file_threads.append(thread)
            thread.start()

        # Add subdirectories to the scanning queue
        for d in self.dir_list:
            self.dir_queue.put(d)

        # Create and start subdirectory scanning threads
        dir_threads = []
        for _ in range(self.num_threads):
            thread = threading.Thread(target=self._scan_subdirectory)
            thread.daemon = True
            dir_threads.append(thread)
            thread.start()

        # Wait for all files to be processed
        self.file_queue.join()
        # Signal worker threads to exit
        for _ in range(self.num_threads):
            self.file_queue.put(None)
        for thread in file_threads:
            thread.join()

        # Wait for all subdirectories to be scanned
        self.dir_queue.join()
        # Signal worker threads to exit
        for _ in range(self.num_threads):
            self.dir_queue.put(None)
        for thread in dir_threads:
            thread.join()

        end_time = time.perf_counter()
        scan_time = end_time - scan_time
        print(f'Scan of {self.path} completed in {scan_time:.3f} seconds. Counted {self.file_count} images and {self.dir_count} directories.')

    # non-threaded folder scan
    def scan_folder(self):
        scan_time = time.perf_counter()
        print(f'Scanning files: {self.path}..')
        # do subdirectories recursively
        if self.dir_count > 0:
            for d in self.dir_list:
                scan = ScanFiles(os.path.join(self.path, d))
                scan.scan_folder()
        # do files
        if self.file_list:
            for f in self.file_list:
                file_path = os.path.join(self.path, f)
                f_file = ImageHandler(file_path=self.path, filename=f)
                try:
                    mime = magic.from_file(file_path, mime=True)
                    mime_parts = mime.split("/")
                    if mime_parts[0] == 'image':
                        f_file.db_add_image()
                        f_file.check_thumbnail()
                    elif mime_parts[0] == 'video': # Corrected condition.
                        print('Video file found, add support for videos!')
                except FileNotFoundError:
                    print(f"Error: File not found: {file_path}")
                except magic.MagicError as e:
                    print(f"Error with magic on {file_path}: {e}")
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

        end_time = time.perf_counter()
        scan_time = end_time - scan_time
        print(f'Scan of {self.path} completed in {scan_time:.3f} seconds. Counted {self.file_count} images and {self.dir_count} directories.')


    def _get_file_list(self):
        file_list = []
        dir_list = []
        try:
            items_with_ctime = []
            for item in os.listdir(self.path):
                item_path = os.path.join(self.path, item)
                try:
                    creation_time = os.path.getctime(item_path)
                    items_with_ctime.append((item, creation_time))
                except OSError as e:
                    print(f"Error getting creation time for {item_path}: {e}")
                    items_with_ctime.append((item, None))

            sorted_items = sorted(items_with_ctime, key=lambda x: (x[1] is None, x[1]))

            for item, _ in sorted_items:  # The underscore "_" is used to discard the ctime
                item_path = os.path.join(self.path, item)
                if os.path.isfile(item_path):
                    file_list.append(item)
                elif os.path.isdir(item_path):
                    db_check_path(item_path)
                    dir_list.append(item)
        except OSError as e:
            print(f"Error accessing path: {self.path}. Error: {e}")
            return [], 0, [], 0
        return file_list, len(file_list), dir_list, len(dir_list)

    def _process_file(self):
        with self.app.app_context():
            while True:
                filename = self.file_queue.get()
                if filename is None:
                    break
                file_path = os.path.join(self.path, filename)
                f_file = ImageHandler(file_path=self.path, filename=filename)
                try:
                    mime = magic.from_file(file_path, mime=True)
                    mime_parts = mime.split("/")
                    if mime_parts[0] == 'image':
                        f_file.db_add_image()
                        f_file.check_thumbnail()
                    elif mime_parts[0] == 'video':  # Corrected condition
                        print(f'Video file found: {file_path}, add support for videos!')
                except FileNotFoundError:
                    print(f"Error: File not found during processing: {file_path}")
                except magic.MagicError as e:
                    print(f"Error with magic on {file_path}: {e}")
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                finally:
                    self.file_queue.task_done()

    def _scan_subdirectory(self):
        with self.app.app_context():
            while True:
                subdir = self.dir_queue.get()
                if subdir is None:
                    break
                sub_scanner = ScanFiles(os.path.join(self.path, subdir))
                sub_scanner.scan_folder_threaded()
                self.dir_queue.task_done()