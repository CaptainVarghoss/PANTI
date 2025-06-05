from app import create_app, socketio_queue_instance # Import the queue instance
from flask import request
from flask_socketio import SocketIO, emit
import logging
import os, time, traceback, threading
from queue import Empty
from threading import Timer, Lock

from app.classes.watcher import FileWatcher

# Get the logger for the 'werkzeug' component (which handles the HTTP server)
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)

app = create_app()

# Initialize SocketIO

socketio = SocketIO(app, cors_allowed_origins="*")

# --- Queue Consumer Thread ---
def queue_consumer_thread(app, message_queue):
    print("Queue consumer thread started.")
    with app.app_context():
        from app.classes.image_handler import ImageHandler
        from app.models import ImagePath

        # --- New: Recently Processed Cache ---
        recently_processed_checksums = set()
        cache_lock = Lock()
        cache_timeout = 10 # Seconds to keep checksum in cache. Should be > debounce_delay.

        def remove_from_cache(checksum):
            with cache_lock:
                if checksum in recently_processed_checksums:
                    recently_processed_checksums.remove(checksum)
                    # print(f"DEBUG: Checksum '{checksum}' removed from recently_processed_cache.")
        # --- End New Cache ---

        while True:
            try:
                event_data = message_queue.get(timeout=0.1)
                # print(f"Consumer thread received consolidated event: {event_data}")

                event_type = event_data.get('event_type') # Now 'file_appeared', 'file_deleted', 'file_moved'
                src_path = event_data.get('src_path')
                is_directory = event_data.get('is_directory') # Will be False for these events
                timestamp = event_data.get('timestamp')
                dest_path = event_data.get('dest_path') # Only for 'file_moved'

                if event_type == 'file_appeared': # This covers both 'created' and initial 'modified'
                    path, filename = os.path.split(src_path)

                    temp_handler = ImageHandler(file_path=path, filename=filename)
                    current_checksum = temp_handler.checksum # Get the checksum upfront

                    if current_checksum is None:
                        #print(f"Skipping processing for {src_path}: Could not get checksum.")
                        continue # Skip this event if checksum can't be obtained (e.g., file still being written)

                    with cache_lock:
                        if current_checksum in recently_processed_checksums:
                            #print(f"Skipping processing for {src_path}: Checksum '{current_checksum}' recently processed.")
                            continue # This is a duplicate event for a recently handled file

                        # If not in cache, add it and schedule its removal
                        recently_processed_checksums.add(current_checksum)
                        Timer(cache_timeout, remove_from_cache, args=[current_checksum]).start()
                        #print(f"DEBUG: Checksum '{current_checksum}' added to recently_processed_cache for {src_path}.")
                    # --- End New Check ---

                    db_path = ImagePath.query.filter_by(path=path).first()

                    if db_path and not db_path.ignore:
                        f_file_handler = ImageHandler(file_path=path, filename=filename)
                        # db_add_image returns a status: 'created', 'skipped_exists', 'skipped_locked', 'error'
                        processing_status, image_id = f_file_handler.db_add_image()

                        if processing_status == 'created':
                            #print(f"NEW Image added to DB: {src_path}")
                            # Emit a 'file_created' event to clients when it's truly new
                            socketio.emit('file_created', {
                                'path': src_path,
                                'filename': os.path.basename(src_path),
                                'timestamp': timestamp,
                                'image_id': image_id
                            })
                        elif processing_status == 'skipped_exists':
                            print(f"File {src_path} detected, checksum already exists in DB. (Likely a re-copy or modified event for existing file).")
                            socketio.emit('file_modified', {
                                'path': src_path,
                                'filename': os.path.basename(src_path),
                                'timestamp': timestamp,
                                'image_id': image_id
                            })
                        elif processing_status == 'skipped_locked':
                            #print(f"File {src_path} was locked, skipped processing.")
                            pass
                        elif processing_status == 'error':
                            print(f"Error processing file {src_path} via ImageHandler.")

                elif event_type == 'file_deleted':
                    # Add logic here to remove from DB or mark as deleted
                    socketio.emit('file_deleted', {'path': src_path, 'filename': os.path.basename(src_path), 'timestamp': timestamp})
                    print(f"Emitted 'file_deleted' for: {src_path}")

                elif event_type == 'file_moved':
                    # You might add logic here to update the path of an image in the DB
                    # Example: image = Image.query.filter_by(path=src_path).first(); if image: image.path = dest_path; db.session.commit()
                    socketio.emit('file_moved', {'old_path': src_path, 'new_path': dest_path, 'timestamp': timestamp})
                    print(f"Emitted 'file_moved' for: {src_path} to {dest_path}")

            except Empty:
                pass
            except Exception as e:
                print(f"An unexpected error occurred in consumer thread: {e}")
                traceback.print_exc()
            time.sleep(0.01) # Yield control to other threads

@socketio.on('connect')
def test_connect():
    socketio.emit('connected')
    print('Client connected:', request.sid)

@socketio.on('disconnect')
def test_disconnect():
    socketio.emit('disconnected')
    print('Client disconnected:', request.sid)

if __name__ == '__main__':
    with app.app_context():
        from app.classes.bulk_functions import startup_scan
        startup_scan()

        # Initialize FileWatcher instance with the queue
        file_watcher_instance = FileWatcher(socketio_queue_instance)

        # Get base paths to watch
        from app.models import ImagePath
        base_paths = ImagePath.query.filter_by(basepath=True).all()
        for bp in base_paths:
            file_watcher_instance.watch(bp.path)

        # Start the queue consumer in a separate thread
        # Pass the app instance so the thread can push app context
        consumer_thread = threading.Thread(target=queue_consumer_thread, args=(app, socketio_queue_instance))
        consumer_thread.daemon = True # Allows main app to exit even if this thread is running
        consumer_thread.start()
        print("Queue consumer thread launched.")

    socketio.run(app, host=app.config['HOST'], port=app.config['PORT'], debug=app.config['DEBUG_MODE'], use_reloader=False)

    # On graceful shutdown (e.g., Ctrl+C), ensure the watcher process is stopped
    # This part might not always run if socketio.run captures KeyboardInterrupt fully.
    print("Application shutting down...")
    file_watcher_instance.stop()