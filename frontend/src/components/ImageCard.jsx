import React, { useState, useEffect, useRef, forwardRef } from 'react';

/**
 * Renders a single image card with its thumbnail and filename.
 *
 * @param {object} props - The component props.
 * @param {object} props.image - The image object containing details like id, filename, and meta.
 * @param {any} props.refreshKey - A key that triggers a refresh of the thumbnail.
 */
const ImageCard = ({ image, onClick, onContextMenu, refreshKey, isSelected, ref: lastImageElementRef }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const retryTimeoutRef = useRef(null);

  const handleImageLoad = () => {
    setIsLoading(false);
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const handleImageError = () => {
    // If the thumbnail fails to load, it might be because it's still generating.
    // We'll retry loading it after a short delay.
    if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
    }
    retryTimeoutRef.current = setTimeout(() => {
      // Appending a timestamp to the URL forces the browser to reload the image.
      setThumbnailUrl(`/api/thumbnails/${image.id}?t=${new Date().getTime()}`);
    }, 2000); // Retry after 2 seconds
  };

  useEffect(() => {
    // Set initial URL
    setThumbnailUrl(`/api/thumbnails/${image.id}`);
  }, [image.id]);


  useEffect(() => {
    // When the refreshKey changes, it means a new thumbnail might be available.
    // Appending a timestamp to the URL forces the browser to reload the image.
    setThumbnailUrl(`/api/thumbnails/${image.id}?t=${new Date().getTime()}`);

    // Cleanup the timeout when the component unmounts or the image changes
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [refreshKey, image.id]);

  return (
    <div
      ref={lastImageElementRef} // The ref for infinite scroll is now passed here
      key={image.id}
      className={`btn-base btn-primary image-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(image)}
      style={{ transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out' }}
    >
      <div className="image-card-inner">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={image.filename}
            onLoad={handleImageLoad}
            style={{ display: isLoading ? 'none' : 'block' }} // Hide image while loading
            onError={handleImageError}
            className="thumbnail"
            onContextMenu={(e) => {
              onContextMenu(e, image);
            }}
          />
        )}
        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCard;
