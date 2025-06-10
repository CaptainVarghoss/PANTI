import os
from PIL import Image as PILImage
from typing import Tuple
from pathlib import Path

def generate_image_versions(
    source_filepath: str,
    output_filename_base: str, # e.g., checksum or image_id
    thumbnail_size: Tuple[int, int], # Now a required argument
    preview_size: Tuple[int, int]    # Now a required argument
) -> dict:

    generated_urls = {}
    source_path_obj = Path(source_filepath)

    if not source_path_obj.is_file():
        print(f"Error: Source file not found: {source_filepath}")
        return generated_urls

    try:
        img = PILImage.open(source_filepath)

        import config

        thumbnail_output_dir = Path(os.path.join(str(config.THUMBNAILS_DIR), output_filename_base))
        preview_output_dir = Path(os.path.join(str(config.PREVIEWS_DIR), output_filename_base))

        os.makedirs(thumbnail_output_dir, exist_ok=True)
        os.makedirs(preview_output_dir, exist_ok=True)

        # Generate Thumbnail
        thumb_img = img.copy()
        thumb_img.thumbnail(thumbnail_size)
        thumb_filepath = thumbnail_output_dir / f"{output_filename_base}_thumb.jpg"
        thumb_img.save(thumb_filepath, "JPEG")
        generated_urls['thumbnail_url'] = f"{config.STATIC_FILES_URL_PREFIX}/{config.GENERATED_MEDIA_DIR_NAME}/{config.THUMBNAILS_DIR_NAME}/{output_filename_base}/{output_filename_base}_thumb.jpg"
        print(f"Generated thumbnail: {thumb_filepath}")

        # Generate Preview
        preview_img = img.copy()
        preview_img.thumbnail(preview_size)
        preview_filepath = preview_output_dir / f"{output_filename_base}_preview.jpg"
        preview_img.save(preview_filepath, "JPEG")
        generated_urls['preview_url'] = f"{config.STATIC_FILES_URL_PREFIX}/{config.GENERATED_MEDIA_DIR_NAME}/{config.PREVIEWS_DIR_NAME}/{output_filename_base}/{output_filename_base}_preview.jpg"
        print(f"Generated preview: {preview_filepath}")

    except PILImage.UnidentifiedImageError:
        print(f"Warning: Could not identify image format for {source_filepath}. Skipping image generation.")
    except Exception as e:
        print(f"Error generating image versions for {source_filepath}: {e}")

    return generated_urls