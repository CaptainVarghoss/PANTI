import React, { forwardRef, useState } from 'react';

/**
 * Renders a single image card with its thumbnail and filename.
 *
 * @param {object} props - The component props.
 * @param {object} props.image - The image object containing details like id, filename, and meta.
 */
const ImageCard = forwardRef(({ image, onClick, onContextMenu }, ref) => {

  //const thumbnailUrl = `${image.thumbnails_path}/${image.checksum}_thumb.webp`;
  const [isLoading, setIsLoading] = useState(true); // Add a loading state
  const thumbnailUrl = `/api/thumbnails/${image.id}`; // Backend endpoint

  return (
    <div ref={ref} key={image.id} className="image-card" onClick={() => onClick(image)}>
      <div className="image-card-inner">
        {thumbnailUrl ? (
          <img
           src={thumbnailUrl}
            alt={image.filename}
            onLoad={() => {
              console.log("Thumbnail loaded successfully");
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
        ) : (
          <div className="">
            No thumbnail available
          </div>
        )}
         {isLoading && (
          <div className="loading-indicator">
            {/* Replace with your actual loading animation */}
            <p>Loading...</p>
            {/* You can use a CSS spinner or a GIF animation here */}
          </div>
        )}

      </div>
    </div>
  );
});

export default ImageCard;