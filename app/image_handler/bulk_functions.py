from app.settings import get_settings
from app.image_handler.image_handler import ImageHandler
import os, time, magic

def startup_scan():
    scan = ScanFiles()
    scan.scan_folder()
    return

class ScanFiles():
    def __init__(self, path=''):
        self.settings = get_settings()
        if path == '':
            self.path = self.settings['base_path']
        else:
            self.path = os.path.join(self.settings['base_path'], path)

        if not os.path.exists(self.path):
            print(f'Error: Path does not exist: {self.path}')
            return

    def scan_folder(self):
        scan_time = time.perf_counter()
        print(f'Scanning files: {self.path}..')
        file_list, file_count, dir_list, dir_count = self.get_file_list()
        # if subdirectories, spawn new instances for them
        if dir_count > 0:
            for d in dir_list:
                # thread here
                scan = ScanFiles(os.path.join(self.path + d))
                scan.scan_folder()
        # do files
        if file_list:
            for f in file_list:
                # thread here
                f_file = ImageHandler(file_path=self.path, filename=f)
                # check mime type
                mime = magic.from_file(os.path.join(self.path, f), mime=True)
                mime = mime.split("/")
                if mime[0] == 'image':
                    f_file.db_add_image()
                    f_file.check_thumbnail()
                elif mime == 'video':
                    print('Video file found, add support for videos!')

        end_time = time.perf_counter()
        scan_time = end_time - scan_time
        print(f'Scan of {self.path} completed in {scan_time:.3f} seconds. Counted {file_count} images and {dir_count} directories.')


    def get_file_list(self):
        file_list = []
        dir_list = []
        file_count = 0
        dir_count = 0
        full_list = os.listdir(self.path)
        for f in full_list:
            if os.path.isfile(os.path.join(self.path, f)):
                file_count += 1
                file_list.append(f)
            elif not os.path.isfile(os.path.join(self.path, f)):
                dir_count += 1
                dir_list.append(f)
            else:
                print('not file or folder?')

        return file_list, file_count, dir_list, dir_count