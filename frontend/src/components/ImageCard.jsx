import React from 'react';

/**
 * Renders a single image card with its thumbnail and filename.
 *
 * @param {object} props - The component props.
 * @param {object} props.image - The image object containing details like id, filename, and meta.
 */
function ImageCard({ image }) {

  const thumbnailUrl = `${image.thumbnails_path}/${image.checksum}_thumb.webp`;
  const previewUrl = `${image.previews_path}/${image.checksum}_preview.webp`;

  return (
    <div key={image.id} className="image-card">
      <div className="image-card-inner">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={image.filename}
            className="thumbnail"
            // Add an onerror handler for broken images.
            // This ensures a fallback image is displayed if the thumbnail URL is invalid or the image is missing.
            onError={(e) => {
              e.target.onerror = null; // Prevent infinite loop if placeholder also fails
              e.target.src = "https://placehold.co/400x400/333333/FFFFFF?text=No+Thumb"; // A simple grey placeholder with text
              console.error(`Failed to load thumbnail for image ID: ${image.id}, filename: ${image.filename}`);
            }}
          />
        ) : (
          <div className="">
            No thumbnail available
          </div>
        )}
        {/*
          Optional: Display preview on hover/click or in a modal.
          Uncomment and implement if you want a larger preview when a user interacts with the thumbnail.
        */}
        {/* {previewUrl && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <img src={previewUrl} alt={`Preview of ${image.filename}`} className="max-w-full max-h-full" />
          </div>
        )} */}
      </div>
    </div>
  );
}

export default ImageCard;