import threading
from flask import Blueprint, current_app
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.classes.image_handler import ImageHandler
from app.routes.settings import get_settings
from threading import Timer
import os

class FileHandler(FileSystemEventHandler):

    def __init__(self, changed_event, ret_params, lock_dir):
        super(FileHandler, self).__init__()
        self.changed_event = changed_event
        self.params = ret_params
        self.timer = None
        self.debounce_delay = 2.0
        self.lock_dir = lock_dir  # Directory for lock files
        os.makedirs(self.lock_dir, exist_ok=True)  # Ensure lock directory exists

    def process(self, event):
        if not event.is_directory and event.event_type == 'created':
            self.params['src_path'] = event.src_path
            self.params['type'] = event.event_type
            self.params['is_dir'] = event.is_directory
            self.changed_event.set()
            print('Watchdog Event: ', event.src_path, event.event_type)

            # check if path is ignored, else add image
            from main import app
            with app.app_context():
                path, filename = os.path.split(event.src_path)
                from app.models import ImagePath
                db_path = ImagePath.query.filter_by(path=path).first()
                if db_path and not db_path.ignore:
                    image = ImageHandler(path, filename)
                    image.db_add_image()

    def on_created(self, event):
        if self.timer:
            self.timer.cancel()
        self.timer = Timer(self.debounce_delay, self.process, args=[event])
        self.timer.start()
        self.process(event)

    def on_modified(self, event):
        # Handles the 'modified' event with debouncing.
        if self.timer:
            self.timer.cancel()
        self.timer = Timer(self.debounce_delay, self.process, args=[event])
        self.timer.start()

class FileWatcher(object):
    # Manages the file system watcher.

    def __init__(self, lock_dir="/tmp/file_watcher_locks"):
        self.watcher = Observer()
        self.event = threading.Event()
        self.params = {}
        self.watch_path = None
        self.lock_dir = lock_dir  # Store lock directory
        os.makedirs(self.lock_dir, exist_ok=True)

    def watch(self, path):
        # Starts watching the specified path.
        if os.path.exists(path):
            self.watch_path = path
            self.watcher.schedule(FileHandler(self.event, self.params, self.lock_dir), path=path, recursive=True)
            self.watcher.start()

    def stop(self):
        # Stops the file system watcher.
        self.watcher.stop()
        self.watcher.join()

    def restart(self):
        # Restarts the file system watcher.
        if self.watch_path: # only restart if a path was watched.
            self.stop()
            self.watcher = Observer() #re-initialize
            self.event = threading.Event()
            self.watch(self.watch_path)

    def reset(self):
        # Resets the event flag.
        self.event.clear()

    def wait(self):
        # Waits for an event to occur and returns the event parameters.
        self.reset()
        self.event.wait()
        print('Exiting from wait')
        return self.params