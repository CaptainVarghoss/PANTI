import React, { forwardRef, useState } from 'react';

/**
 * Renders a single image card with its thumbnail and filename.
 *
 * @param {object} props - The component props.
 * @param {object} props.image - The image object containing details like id, filename, and meta.
 */
const ImageCard = forwardRef(({ image, onClick, onContextMenu }, ref) => {

  const [isLoading, setIsLoading] = useState(true); // Add a loading state
  const thumbnailUrl = `/api/thumbnails/${image.id}`; // Backend endpoint

  return (
    <div ref={ref} key={image.id} className="image-card" onClick={() => onClick(image)}>
      <div className="image-card-inner">
        {thumbnailUrl && (
          <img
           src={thumbnailUrl}
            alt={image.filename}
            onLoad={() => {
              setIsLoading(false);
            }}
            style={{ display: isLoading ? 'none' : 'block' }} // Hide image while loading
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://placehold.co/400x400/333333/FFFFFF?text=No+Thumb";
              setIsLoading(false); // Ensure loading is turned off even on error
              console.error(`Failed to load thumbnail for image ID: ${image.id}, filename: ${image.filename}, Error: ${e.target.error}`);
            }}
            className="thumbnail"
            onContextMenu={(e) => {
              onContextMenu(e, image);
            }}
          />
        )}
        {isLoading && (
          <div className="loading-indicator">
            {/* Replace with loading animation */}
            <p>Loading...</p>
          </div>
        )}

      </div>
    </div>
  );
});

export default ImageCard;