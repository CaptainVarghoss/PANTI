import time
import os
from multiprocessing import Process
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from threading import Timer, Lock
from collections import defaultdict

class FileHandler(FileSystemEventHandler):
    def __init__(self, message_queue, lock_dir):
        super(FileHandler, self).__init__()
        self.message_queue = message_queue
        self.debounce_delay = 3.0 # seconds - Adjust as needed for stability
        self.lock_dir = lock_dir
        os.makedirs(self.lock_dir, exist_ok=True)

        # Debouncing related variables
        self.timers = {} # {file_path: Timer object}
        # Stores collected events for a path during the debounce window
        # Key: file_path, Value: list of (event_type, event_object) tuples
        self.event_queue_for_debounce = defaultdict(list)
        self.debounce_lock = Lock() # Protects access to timers and event_queue_for_debounce

    def _process_debounced_event(self, file_path):
        with self.debounce_lock:
            events_for_path = self.event_queue_for_debounce.pop(file_path, [])
            if not events_for_path:
                return

            # Initialize with a lower-priority event if available
            primary_type = None
            primary_event_obj = None # The actual watchdog event object

            for event_type_str, event_obj in events_for_path:
                if event_type_str == 'created':
                    primary_type = 'file_appeared' # Treat as "appeared" rather than raw 'created'
                    primary_event_obj = event_obj
                    break # Found the most important event, no need to check further
                elif event_type_str == 'moved':
                    if primary_type not in ['file_appeared']: # 'moved' is higher than 'modified'
                        primary_type = 'file_moved'
                        primary_event_obj = event_obj
                elif event_type_str == 'modified':
                    if primary_type is None: # Only if nothing higher has been found
                        primary_type = 'file_appeared' # Treat modified on initial appearance as "appeared"
                        primary_event_obj = event_obj
                elif event_type_str == 'deleted':
                    pass # We'll handle this outside the primary event logic if needed

            # If the file was ultimately deleted (e.g., created and then immediately deleted)
            # Find the latest 'deleted' event.
            latest_deleted_event = None
            for event_type_str, event_obj in reversed(events_for_path):
                if event_type_str == 'deleted':
                    latest_deleted_event = event_obj
                    break

            # If a deleted event was the latest and it was the primary action, prioritize it.
            if latest_deleted_event and (primary_type is None or events_for_path[-1][0] == 'deleted'):
                primary_type = 'file_deleted'
                primary_event_obj = latest_deleted_event


            if not primary_type or not primary_event_obj:
                # If no relevant file event (e.g., only directory events or no events), skip
                return

            # Prepare data to send to the main process
            event_data = {
                'src_path': primary_event_obj.src_path,
                'event_type': primary_type, # This will be our consolidated event type
                'is_directory': primary_event_obj.is_directory,
                'timestamp': time.time() # Use current time for when processed
            }
            if primary_type == 'file_moved':
                event_data['dest_path'] = primary_event_obj.dest_path

            # Put the event data onto the shared queue
            self.message_queue.put(event_data)
            print(f'Watchdog Event (queued after debounce): {event_data["event_type"]} - {event_data["src_path"]}')


    def _schedule_debounced_process(self, raw_event):
        # Use src_path as the key for debouncing.
        # For moved events, the old path is src_path, new path is dest_path.
        path_to_debounce = raw_event.src_path

        with self.debounce_lock:
            # Store the raw event with its type string for later processing
            self.event_queue_for_debounce[path_to_debounce].append((raw_event.event_type, raw_event))

            # If a timer already exists for this path, cancel it (reschedule)
            if path_to_debounce in self.timers:
                self.timers[path_to_debounce].cancel()

            # Start a new timer for this path
            self.timers[path_to_debounce] = Timer(
                self.debounce_delay,
                self._process_debounced_event,
                args=[path_to_debounce]
            )
            self.timers[path_to_debounce].start()


    # Override all relevant event handlers to use the debouncing logic
    def on_created(self, event):
        if not event.is_directory:
            #print(f"DEBUG: Raw 'created' event: {event.src_path}")
            self._schedule_debounced_process(event)

    def on_modified(self, event):
        if not event.is_directory:
            #print(f"DEBUG: Raw 'modified' event: {event.src_path}")
            self._schedule_debounced_process(event)

    def on_deleted(self, event):
        if not event.is_directory:
            #print(f"DEBUG: Raw 'deleted' event: {event.src_path}")
            self._schedule_debounced_process(event)

    def on_moved(self, event):
        # Handle moved events. Both src_path and dest_path are important.
        # We'll use src_path as the primary key for debouncing, but capture dest_path.
        if not event.is_directory:
            #print(f"DEBUG: Raw 'moved' event: {event.src_path} -> {event.dest_path}")
            self._schedule_debounced_process(event) # This will store the full event object

def _run_watcher_process(path_to_watch, message_queue, lock_dir):
    print(f"File watcher process (PID: {os.getpid()}) started for: {path_to_watch}")
    event_handler = FileHandler(message_queue, lock_dir)
    observer = Observer()
    observer.schedule(event_handler, path=path_to_watch, recursive=True)
    observer.start()
    try:
        while True:
            time.sleep(1) # Keep the watcher process alive
    except KeyboardInterrupt:
        print("\nFile watcher process received KeyboardInterrupt. Stopping...")
    finally:
        observer.stop()
        observer.join()
        print("File watcher process stopped.")

class FileWatcher:
    # Manages the file system watcher.

    def __init__(self, message_queue, lock_dir="/tmp/file_watcher_locks"):
        self.message_queue = message_queue
        self.watcher_process = None
        self.watch_path = None
        self.lock_dir = lock_dir  # Store lock directory
        os.makedirs(self.lock_dir, exist_ok=True)

    def watch(self, path):
        # Starts watching the specified path.

        if self.watcher_process and self.watcher_process.is_alive():
            print('Watcher already running. Stopping before restarting.')
            self.stop()

        if os.path.exists(path):
            self.watch_path = path
            self.watcher_process = Process(
                target=_run_watcher_process,
                args=(self.watch_path, self.message_queue, self.lock_dir)
            )
            self.watcher_process.daemon = True
            self.watcher_process.start()
            print(f'File watcher process launched for: {self.watch_path}')
        else:
            print(f'Error: Path does not exist - {path}')

    def stop(self):
        # Stops the file system watcher.
        if self.watcher_process and self.watcher_process.is_alive():
            print("Stopping file watcher process...")
            self.watcher_process.terminate() # Send termination signal
            self.watcher_process.join(timeout=5) # Wait for process to terminate
            if self.watcher_process.is_alive():
                print("Warning: File watcher process did not terminate gracefully.")
            self.watcher_process = None
            print("File watcher process stopped.")

    def restart(self):
        # Restarts the file system watcher.
        if self.watch_path:
            print("Restarting file watcher...")
            self.stop()
            self.watch(self.watch_path)
        else:
            print("No path was being watched, cannot restart.")
