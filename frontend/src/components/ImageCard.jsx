import React, { forwardRef } from 'react';

/**
 * Renders a single image card with its thumbnail and filename.
 *
 * @param {object} props - The component props.
 * @param {object} props.image - The image object containing details like id, filename, and meta.
 */
const ImageCard = forwardRef(({ image, onClick }, ref) => {

  const thumbnailUrl = `${image.thumbnails_path}/${image.checksum}_thumb.webp`;

  return (
    <div ref={ref} key={image.id} className="image-card" onClick={() => onClick(image)}>
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
      </div>
    </div>
  );
});

export default ImageCard;