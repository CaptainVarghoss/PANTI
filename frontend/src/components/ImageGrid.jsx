import React, { useState, useEffect } from 'react';
import ImageCard from '../components/ImageCard'; // Assuming ImageCard is in components
import { useAuth } from '../context/AuthContext'; // To get token for authenticated calls

/**
 * Component to display the image gallery.
 * Fetches image data from the backend and renders them using ImageCard components.
 */
function ImageGrid() { // Renamed from ImageGridPage to ImageGrid
  const { token, isAuthenticated } = useAuth();
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imagesError, setImagesError] = useState(null);

  // Fetch images on component mount and when authentication status changes
  useEffect(() => {
    if (isAuthenticated) { // Only fetch if authenticated
      fetchImages();
    } else {
      setImages([]); // Clear images if not authenticated
      setImagesLoading(false);
      setImagesError("Please log in to view images.");
    }
  }, [isAuthenticated, token]); // Re-run when isAuthenticated or token changes

  const fetchImages = async () => {
    setImagesLoading(true);
    setImagesError(null);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/images/', { headers }); // Use token for protected route
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Details:', response.status, response.statusText, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setImages(data);
    } catch (error) {
      console.error('Error fetching images:', error);
      setImagesError('Failed to load images. Ensure backend scanner has run and images exist.');
    } finally {
      setImagesLoading(false);
    }
  };

  return (
    <div className="image-grid">

      {imagesLoading && <p className="">Loading images...</p>}
      {imagesError && <p className="">{imagesError}</p>}

      {!imagesLoading && !imagesError && images.length === 0 && (
        <p className="">No images found. Add some to your configured paths and run the scanner!</p>
      )}

      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </div>
  );
}

export default ImageGrid; // Export as ImageGrid