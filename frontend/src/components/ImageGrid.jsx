import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImageCard from '../components/ImageCard'; // Assuming ImageCard is in components
import { useAuth } from '../context/AuthContext'; // To get token and settings for authenticated calls

/**
 * Component to display the image gallery with infinite scrolling using cursor-based pagination.
 * Fetches image data from the backend in pages and appends them.
 */
function ImageGrid() {
  const { token, isAuthenticated, settings } = useAuth();
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true); // For initial load state
  const [imagesError, setImagesError] = useState(null);
  const [lastId, setLastId] = useState(null); // Cursor for pagination: ID of the last image fetched
  const [hasMore, setHasMore] = useState(true); // True if there are more images to load
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Tracks if a fetch for more images is in progress

  const lastIdRef = useRef(lastId);
  useEffect(() => {
    lastIdRef.current = lastId;
  }, [lastId]);

  // Get imagesPerPage from settings, default to 60 if not available or invalid
  const imagesPerPage = parseInt(settings.thumb_num) || 60;

  // Fetch images function, now accepting an optional cursor (last_id)
  const fetchImages = useCallback(async (currentLastId) => {
    console.log(`[fetchImages] Attempting fetch. currentLastId: ${currentLastId}, isFetchingMore: ${isFetchingMore}, images.length: ${images.length}`);

    if (isFetchingMore) {
      console.log('[fetchImages] Already fetching, aborting.');
      return;
    }

    // Set appropriate loading state based on whether it's the initial load or a subsequent fetch
    if (images.length === 0 && currentLastId === null) {
      setImagesLoading(true);
      setImagesError(null); // Clear any previous errors on initial load
      console.log('[fetchImages] Initial load triggered.');
    } else {
      setIsFetchingMore(true);
      setImagesError(null); // Clear any previous errors on subsequent loads
      console.log('[fetchImages] Subsequent load triggered.');
    }

    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const queryString = new URLSearchParams();
      queryString.append('limit', imagesPerPage);
      if (currentLastId !== null) {
        queryString.append('last_id', currentLastId);
      }

      console.log(`[fetchImages] API call: /api/images/?${queryString.toString()}`);
      const response = await fetch(`/api/images/?${queryString.toString()}`, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Details:', response.status, response.statusText, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json(); // Array of new images from the backend
      console.log('[fetchImages] Received data length:', data.length);

      setImages(prevImages => {
        // Filter out duplicates to prevent React key warnings and redundant data
        const existingIds = new Set(prevImages.map(img => img.id));
        const uniqueNewImages = data.filter(img => !existingIds.has(img.id));
        console.log(`Fetched ${data.length} images, added ${uniqueNewImages.length} unique images.`);
        return [...prevImages, ...uniqueNewImages]; // Append only unique new images
      });

      // Update the cursor (lastId) for the next potential fetch
      if (data.length > 0) {
        const newLastId = data[data.length - 1].id;
        setLastId(newLastId); // The ID of the very last image received
        console.log('[fetchImages] New lastId set to:', newLastId);
      } else {
        setLastId(null); // No data, reset cursor or keep it null
        console.log('[fetchImages] No new data, lastId remains null.');
      }

      // Determine if there are more pages to load.
      // If the number of images received is less than the requested limit, it means this was the last page.
      setHasMore(data.length === imagesPerPage);
      console.log('[fetchImages] hasMore set to:', data.length === imagesPerPage);

    } catch (error) {
      console.error('Error fetching images:', error);
      setImagesError('Failed to load images. Ensure backend scanner has run and images exist.');
      setHasMore(false); // Stop trying to fetch more if there's an error
    } finally {
      setImagesLoading(false); // Always set to false after initial load attempt
      setIsFetchingMore(false); // Always set to false after a "fetching more" attempt
      console.log('[fetchImages] FetchImages finished. imagesLoading:', false, 'isFetchingMore:', false);
    }
  }, [token, imagesPerPage, images.length]); // `images.length` is kept for the `isInitialLoad` check at the top of this function.


  // Ref for the element to observe for infinite scrolling
  const observer = useRef();
  const lastImageElementRef = useCallback(node => {
    console.log('[lastImageElementRef] Callback triggered. Node:', node ? 'exists' : 'null', 'imagesLoading:', imagesLoading, 'isFetchingMore:', isFetchingMore, 'hasMore:', hasMore);
    // Conditions to stop observing or prevent fetching:
    // 1. If an initial load is in progress (`imagesLoading`)
    // 2. If a subsequent fetch is already in progress (`isFetchingMore`)
    // 3. If there are no more images to fetch (`!hasMore`)
    if (imagesLoading || isFetchingMore || !hasMore) {
      if (observer.current) {
        console.log('[lastImageElementRef] Disconnecting observer due to loading/fetching/noMoreData.');
        observer.current.disconnect(); // Disconnect if we should stop observing
      }
      return;
    }

    // Disconnect previous observer to avoid multiple observations
    if (observer.current) observer.current.disconnect();

    // Create a new IntersectionObserver instance
    observer.current = new IntersectionObserver(entries => {
      console.log('[IntersectionObserver] Entry intersecting:', entries[0].isIntersecting, 'Current hasMore:', hasMore, 'Current isFetchingMore:', isFetchingMore);
      // If the target element is intersecting (visible) and we have more data, and not already fetching
      if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
        console.log('[IntersectionObserver] Conditions met: Fetching next page.');
        // Directly call fetchImages to load the next page using the current lastId
        // This is the trigger for subsequent pages.
        fetchImages(lastIdRef.current);
      }
    }, {
      root: null, // Use the viewport as the root element
      rootMargin: '100px', // When the target element is 100px from the bottom of the viewport, trigger the callback
      threshold: 0.1 // Trigger when 10% of the target element is visible
    });

    // Start observing the provided DOM node if it exists
    if (node) observer.current.observe(node);
  }, [imagesLoading, isFetchingMore, hasMore, fetchImages]); // Dependencies for useCallback: ensure correct state values are captured


  // Effect for initial page load only
  useEffect(() => {
    console.log('[useEffect for initial load] Authenticated:', isAuthenticated, 'imagesPerPage:', imagesPerPage, 'images.length:', images.length, 'isFetchingMore:', isFetchingMore);
    // This effect ensures fetchImages(null) is called only once
    // when the component mounts, provided the user is authenticated,
    // and no images have been loaded yet, and it's not already in an initial loading state.
    if (isAuthenticated && imagesPerPage > 0 && images.length === 0 && !isFetchingMore) {
      setImagesLoading(true);
      fetchImages(null); // Fetch the very first page of images (cursor is null)
    } else if (!isAuthenticated) {
      // If not authenticated, clear images and reset all relevant states
      setImages([]);
      setImagesLoading(false);
      setIsFetchingMore(false);
      setHasMore(false);
      setLastId(null);
      setImagesError("Please log in to view images.");
    }
  }, [isAuthenticated, imagesPerPage, fetchImages, images.length, isFetchingMore]); // Dependencies to control when this effect runs

  return (
    <div className="image-grid">

      {imagesError && <p className="">{imagesError}</p>}

      {imagesLoading && images.length === 0 && (
        <p className="">Loading images...</p>
      )}

      {images.map((image, index) => {
        if (images.length === index + 1 && hasMore) {
            return <ImageCard ref={lastImageElementRef} key={image.id} image={image} />;
        }
        return <ImageCard key={image.id} image={image} />;
      })}

      {isFetchingMore && (
        <p className="">Loading more images...</p>
      )}

      {!hasMore && !imagesLoading && !isFetchingMore && images.length > 0 && (
        <p className=""></p>
      )}

      {!imagesLoading && !isFetchingMore && images.length === 0 && !imagesError && (
        <p className="text-gray-400 text-center">No images found. Add some to your configured paths and run the scanner!</p>
      )}
    </div>
  );
}

export default ImageGrid; // Export as ImageGrid