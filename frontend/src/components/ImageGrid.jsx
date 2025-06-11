import React, { useState, useEffect } from 'react';
import ImageCard from "./ImageCard"

function ImageGrid() {

  // --- Image Grid State ---
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imagesError, setImagesError] = useState(null);

  // Fetch images on component mount
  useEffect(() => {
    fetchImages();
  }, []); // Empty dependency array means this runs once on mount

  // --- Image Grid Functionality ---
  const fetchImages = async () => {
    setImagesLoading(true);
    setImagesError(null);
    try {
      const response = await fetch('/api/images/');
      if (!response.ok) {
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
    <div className="">
    {imagesLoading && <p className="">Loading images...</p>}
    {imagesError && <p className="">{imagesError}</p>}

    {!imagesLoading && !imagesError && images.length === 0 && (
        <p className="">No images found. Add some to your configured paths and run the scanner!</p>
    )}

    {/* Responsive Grid for Images */}
    <div className="">
        {images.map((image) => (
        // Render the ImageCard component for each image
        <ImageCard key={image.id} image={image} />
        ))}
    </div>
    </div>
  )
}

export default ImageGrid;