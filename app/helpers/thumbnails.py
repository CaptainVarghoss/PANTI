from app.models import db, Image # Import db and Image model
from app.routes.settings import get_settings # For thumbnail size
import os, shlex, time
from PIL import Image as Pimage

from app.classes.image_handler import cpu_bound_pool

def _execute_thumbnail_creation_in_pool(app_instance, full_file_path, checksum, is_video, image_id, socketio_instance, thumb_size):
    # Executes the CPU-bound thumbnail creation process.
    # This function is designed to be run within the cpu_bound_pool.
    with app_instance.app_context(): # Establish app context for get_settings()
        thumbnail_filepath = os.path.join('app/static/thumbnails/', f'{checksum}.webp')
        if os.path.exists(thumbnail_filepath):
            if socketio_instance:
                socketio_instance.emit('thumbnail_ready', {'image_id': image_id, 'checksum': checksum})
            return True # Already exists, no need to recreate

        image_to_process = None
        temp_image_path = None
        success = False
        try:
            os.makedirs(os.path.dirname(thumbnail_filepath), exist_ok=True) # Ensure thumb dir exists

            if is_video:
                temp_image_path = os.path.join('app/static/thumbnails/', f'{checksum}_temp_thumb.png')

                quoted_full_file_path = shlex.quote(full_file_path)
                quoted_temp_image_path = shlex.quote(temp_image_path)

                command = (
                    f"ffmpeg -i {quoted_full_file_path} -ss 00:00:00.001 -vframes 1 -q:v 2 {quoted_temp_image_path} "
                    f">/dev/null 2>&1"
                )

                return_code = os.system(command)
                if return_code != 0:
                    print(f"FFmpeg Error (status {return_code}) for {full_file_path}. Command: {command}")
                    return False

                time.sleep(0.1) # Small delay for filesystem consistency

                image_to_process = Pimage.open(temp_image_path)
            else: # Assuming it's an image
                image_to_process = Pimage.open(full_file_path)

            if image_to_process:
                if image_to_process.mode in ('RGBA', 'P', 'LA'):
                    image_to_process = image_to_process.convert('RGB')

                image_to_process.thumbnail((thumb_size, thumb_size))
                image_to_process.save(thumbnail_filepath, 'webp', quality=85)
                image_to_process.close()
                success = True
                return True

        except Pimage.UnidentifiedImageError:
            print(f"Thumbnail generation error: PIL could not identify image for {full_file_path}")
            return False
        except Exception as e:
            print(f"Error during thumbnail generation for {full_file_path}: {e}")
            return False
        finally:
            if temp_image_path and os.path.exists(temp_image_path):
                try:
                    os.remove(temp_image_path)
                    print(f"Deleted temporary thumbnail file: {temp_image_path}")
                except Exception as e:
                    print(f"Error deleting temporary file {temp_image_path}: {e}")

            if success and socketio_instance:
                socketio_instance.emit('thumbnail_ready', {'image_id': image_id, 'checksum': checksum})

# --- Public API for thumbnail generation by ID ---
def generate_image_thumbnail(image_record: Image, settings, app_instance, socketio_instance):
    if not isinstance(image_record, Image):
        print(f"Error: Expected an Image object, got {type(image_record)}")
        return False

    # Get necessary info from the database record
    image_id = image_record.id
    full_file_path = os.path.join(image_record.path, image_record.filename)
    checksum = image_record.checksum
    is_video = image_record.is_video
    thumb_size = int(settings['thumb_size'])

    # Check if thumbnail already exists based on checksum
    thumbnail_filepath = os.path.join('app/static/thumbnails/', f'{checksum}.webp')
    if os.path.exists(thumbnail_filepath):
        if socketio_instance:
            socketio_instance.emit('thumbnail_ready', {'image_id': image_id, 'checksum': checksum})
        return True # Thumbnail already exists, nothing to do

    print(f"Initiating thumbnail generation for image ID {image_id} ({image_record.filename})...")
    # Offload the actual thumbnail creation to the CPU-bound thread pool
    # This spawns a native thread, preventing blocking the gevent event loop.
    # The result will be .get() by the calling greenlet.
    return cpu_bound_pool.spawn(
        _execute_thumbnail_creation_in_pool,
        app_instance, # Pass the app_instance for context management within the thread
        full_file_path,
        checksum,
        is_video,
        image_id,
        socketio_instance,
        thumb_size
    ).get()

