import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImageCard from '../components/ImageCard';
import ImageModal from '../components/ImageModal';
import ContextMenu from './ContextMenu';
import SelectionToolbar from './SelectionToolbar';
import { useAuth } from '../context/AuthContext'; // To get token and settings for authenticated calls

/**
 * Component to display the image gallery with infinite scrolling using cursor-based pagination.
 * Fetches image data from the backend in pages and appends them.
 */
function ImageGrid({
  searchTerm,
  setSearchTerm,
  sortBy,
  sortOrder,
  filters,
  webSocketMessage,
  isSelectMode,
  setIsSelectMode
}) {
  const { token, isAuthenticated, settings } = useAuth();
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true); // For initial load state
  const [imagesError, setImagesError] = useState(null);
  const [lastId, setLastId] = useState(null); // Cursor for pagination: ID of the last image fetched
  const [lastSortValue, setLastSortValue] = useState(null);
  const [hasMore, setHasMore] = useState(true); // True if there are more images to load
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Tracks if a fetch for more images is in progress

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImages, setSelectedImages] = useState(new Set());

  const [contextMenu, setContextMenu] = useState({
      isVisible: false,
      x: 0,
      y: 0,
      thumbnailData: null, // Data of the thumbnail that was right-clicked
    });

  const lastIdRef = useRef(lastId);
  const lastSortValueRef = useRef(lastSortValue);
  useEffect(() => {
    lastIdRef.current = lastId;
    lastSortValueRef.current = lastSortValue;
  }, [lastId, lastSortValue]);

  // Get imagesPerPage from settings, default to 60 if not available or invalid
  const imagesPerPage = parseInt(settings.thumb_num) || 60;

  const fetchImageById = useCallback(async (imageId) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`/api/images/${imageId}`, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP Error Details for image ${imageId}:`, response.status, response.statusText, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching image ${imageId}:`, error);
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (webSocketMessage && webSocketMessage.type === 'thumbnail_generated') {
      //console.log("WebSocket message received in ImageGrid:", webSocketMessage);
      const { image } = webSocketMessage;

      if (!image) {
        console.error("WebSocket message of type 'thumbnail_generated' did not contain an 'image' object.");
        return;
      }

      fetchImageById(image.id).then(fetchedImage => {
        if (fetchedImage) {
          setImages(prevImages => {
            const existingImageIndex = prevImages.findIndex(img => img.id === fetchedImage.id);

            if (existingImageIndex > -1) {
              // Image exists, update its thumbnail_url and refreshKey
              const updatedImages = [...prevImages];
              updatedImages[existingImageIndex] = {
                ...updatedImages[existingImageIndex],
                thumbnail_url: image.thumbnail_url, // Update with the new thumbnail URL
                refreshKey: new Date().getTime(), // Trigger re-render
              };
              return updatedImages;
            } else {
              // Image does not exist, add it to the beginning
              const newImageEntry = { ...fetchedImage, thumbnail_url: image.thumbnail_url, refreshKey: new Date().getTime() };
              return [newImageEntry, ...prevImages];
            }
          });
        } else {
          console.log("Fetched image was null or undefined, not updating state.");
        }
      });
    }
  }, [webSocketMessage, fetchImageById]);

  const handleImageClick = useCallback((image) => {
    if (isSelectMode) {
      // In select mode, toggle selection
      setSelectedImages(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(image.id)) {
          newSelected.delete(image.id);
        } else {
          newSelected.add(image.id);
        }
        return newSelected;
      });
    } else {
      // Normal mode, open modal
      setSelectedImage(image);
      setIsModalOpen(true);
    }
  }, [isSelectMode]);

  // Handle navigating to a different image within the modal
  const handleModalNavigate = useCallback((image) => {
    setSelectedImage(image);
  }, []);

  // Handle closing the modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedImage(null);
  }, []);

  // Handle right-click event on a thumbnail
  const handleContextMenu = (event, thumbnail) => {
    if (isSelectMode) return; // Disable context menu in select mode

    event.preventDefault(); // Prevent default browser context menu
    setContextMenu({
        isVisible: true,
        x: event.clientX,
        y: event.clientY,
        thumbnailData: thumbnail,
    });
  };

  // Close the context menu
  const handleCloseContextMenu = () => {
      setContextMenu({ ...contextMenu, isVisible: false });
  };

  const addTrashTagToImages = async (imageIds) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/trash_tag', { headers });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("The 'Trash' tag does not exist. Please create it first.");
        }
        throw new Error('Failed to fetch the Trash tag');
      }
      const trashTag = await response.json();

      // Create a batch of promises to update all selected images
      const updatePromises = imageIds.map(imageId => {
        const imageToUpdate = images.find(img => img.id === imageId);
        if (!imageToUpdate) {
          console.error(`Image with ID ${imageId} not found in state.`);
          return Promise.resolve(); // Skip this one
        }

        const existingTagIds = imageToUpdate.tags.map(tag => tag.id);
        if (existingTagIds.includes(trashTag.id)) {
          return Promise.resolve(); // Already tagged
        }

        const updatedTagIds = [...existingTagIds, trashTag.id];

        return fetch(`/api/images/${imageId}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tag_ids: updatedTagIds }),
        });
      });

      const results = await Promise.all(updatePromises);

      // After all updates, refetch or update state locally
      // For simplicity, we'll just clear selection and let the user see the result on next load
      // A more robust solution would update the state for each image.
      const updatedImages = await Promise.all(results.filter(res => res.ok).map(res => res.json()));

      setImages(prevImages =>
        prevImages.map(img => {
          const updatedVersion = updatedImages.find(uImg => uImg.id === img.id);
          return updatedVersion ? { ...img, ...updatedVersion, refreshKey: new Date().getTime() } : img;
        })
      );

    } catch (error) {
      console.error("Error adding 'Trash' tag:", error);
      alert("Error adding 'Trash' tag: " + error.message);
    }
  };

  // Handle click on a context menu item
  const handleMenuItemClick = (action, data) => {
      console.log(`Action: ${action} on Thumbnail ID: ${data.id}`);
      // Implement specific logic based on the action
      switch (action) {
        case 'select':
            setIsSelectMode(true);
            setSelectedImages(new Set([data.id]));
            break;
        case 'delete':
            addTrashTagToImages([data.id]);
            break;
        default:
            break;
      }
  };

  // Clear selection when exiting select mode
  useEffect(() => {
    if (!isSelectMode) {
      setSelectedImages(new Set());
    }
  }, [isSelectMode]);

  // Fetch images function, now accepting an optional cursor (last_id)
  const fetchImages = useCallback(async (
    currentLastId,
    currentLastSortValue,
    currentSearchTerm,
    currentSortBy,
    currentSortOrder
  ) => {
    if (isFetchingMore && currentLastId !== null) {
      return;
    }

    // Set appropriate loading state based on whether it's the initial load or a subsequent fetch
    setImagesLoading(prev => prev || (images.length === 0 && currentLastId === null));
    setIsFetchingMore(prev => prev || (images.length !== 0 || currentLastId !== null)); // Set fetching more for subsequent
    setImagesError(null); // Clear any previous errors

    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const queryString = new URLSearchParams();
      queryString.append('limit', imagesPerPage);
      queryString.append('sort_by', currentSortBy);
      queryString.append('sort_order', currentSortOrder);

      if (currentSearchTerm) {
        queryString.append('search_query', currentSearchTerm);
      }
      if (currentLastId !== null) {
        queryString.append('last_id', currentLastId);
      }
      if (currentLastSortValue !== null) {
        queryString.append('last_sort_value', currentLastSortValue);
      }

      // Check for active filters and pass IDs
      if (filters) {
        const usedFilters = filters.map(filter => {
          if (filter.isSelected === true) {
            queryString.append('filter', filter.id);
          }
        })
      }

      const response = await fetch(`/api/images/?${queryString.toString()}`, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Details:', response.status, response.statusText, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json(); // Array of new images from the backend

      setImages(prevImages => {
        // If it's a new search/sort, replace existing images, otherwise append
        // This condition correctly resets the grid when search/sort parameters change
        if (currentLastId === null) {
          return data;
        } else {
          // Filter out duplicates to prevent React key warnings and redundant data
          const existingIds = new Set(prevImages.map(img => img.id));
          const uniqueNewImages = data.filter(img => !existingIds.has(img.id));
          return [...prevImages, ...uniqueNewImages]; // Append only unique new images
        }
      });

      // Update the cursor (lastId and lastSortValue) for the next potential fetch
      if (data.length > 0) {
        const newLastImage = data[data.length - 1];
        setLastId(newLastImage.id);
        // The backend should return the specific value used for sorting in the Image schema
        // For simplicity, we'll assume the sort_by value is directly accessible.
        // In a real scenario, you might need a specific field for this or derive it.
        let valForSort = newLastImage[currentSortBy];
        // Handle date_created if it's a date object
        if (currentSortBy === 'date_created') {
          valForSort = new Date(valForSort).toISOString(); // Convert to ISO string for consistent comparison
        }
        setLastSortValue(valForSort);
      } else {
        setLastId(null);
        setLastSortValue(null);
      }

      setHasMore(data.length === imagesPerPage);

    } catch (error) {
      console.error('Error fetching images:', error);
      setImagesError('Failed to load images. Ensure backend scanner has run and images exist, and you are logged in if required.');
      setHasMore(false); // Stop trying to fetch more if there's an error
    } finally {
      setImagesLoading(false);
      setIsFetchingMore(false);
    }
  }, [token, imagesPerPage, filters]);


  // Effect for initial page load and when search/sort parameters change (now from props)
  useEffect(() => {
    // Only fetch if authenticated and imagesPerPage is valid
    if (isAuthenticated && imagesPerPage > 0) {
      // Reset pagination state when search, sort, or sort order changes (received via props)
      setImages([]);
      setLastId(null);
      setLastSortValue(null);
      setHasMore(true);
      setImagesLoading(true); // Indicate loading for the new query

      // Fetch the first page with the new search/sort parameters
      fetchImages(null, null, searchTerm, sortBy, sortOrder);
    } else if (!isAuthenticated) {
      // If not authenticated, clear images and reset all relevant states
      setImages([]);
      setImagesLoading(false);
      setIsFetchingMore(false);
      setHasMore(false);
      setLastId(null);
      setLastSortValue(null);
      setImagesError("Please log in to view images.");
    }
  }, [isAuthenticated, imagesPerPage, searchTerm, sortBy, sortOrder, fetchImages, filters]);
  
  // Ref for the element to observe for infinite scrolling
  const observer = useRef();
  const lastImageElementRef = useCallback(node => {
    if (imagesLoading || isFetchingMore || !hasMore) {
      if (observer.current) {
        observer.current.disconnect(); // Disconnect if we should stop observing
      }
      return;
    }

    // Disconnect previous observer to avoid multiple observations
    if (observer.current) observer.current.disconnect();

    // Create a new IntersectionObserver instance
    observer.current = new IntersectionObserver(entries => {
      // If the target element is intersecting (visible) and we have more data, and not already fetching
      if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
        // Directly call fetchImages to load the next page using the current lastId
        // This is the trigger for subsequent pages.
        fetchImages(lastIdRef.current, lastSortValueRef.current, searchTerm, sortBy, sortOrder);
      }
    }, {
      root: null, // Use the viewport as the root element
      rootMargin: '100px', // When the target element is 100px from the bottom of the viewport, trigger the callback
      threshold: 0.1 // Trigger when 10% of the target element is visible
    });

    // Start observing the provided DOM node if it exists
    if (node) observer.current.observe(node);
  }, [imagesLoading, isFetchingMore, hasMore, fetchImages, searchTerm, sortBy, sortOrder]);

  // --- Selection Toolbar Handlers ---
  const handleSelectAll = () => {
    const allImageIds = new Set(images.map(img => img.id));
    setSelectedImages(allImageIds);
  };

  const handleClearSelection = () => {
    setSelectedImages(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedImages.size > 0) {
      if (window.confirm(`Are you sure you want to delete ${selectedImages.size} image(s)? This will add the 'Trash' tag.`)) {
        addTrashTagToImages(Array.from(selectedImages));
        setSelectedImages(new Set()); // Clear selection after action
      }
    }
  };

  const handleMoveSelected = () => {
    // Placeholder for move functionality
    alert(`Move action for ${selectedImages.size} images is not yet implemented.`);
  };

  return (
    <>
      {isSelectMode && (
        <SelectionToolbar
          selectedCount={selectedImages.size}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onDelete={handleDeleteSelected}
          onMove={handleMoveSelected}
          onExit={() => setIsSelectMode(false)}
        />
      )}
      <div className={`image-grid ${isSelectMode ? 'select-mode' : ''}`}>

        {imagesError && <p className="">{imagesError}</p>}

        {imagesLoading && images.length === 0 && !imagesError && (
          <p className="">Loading images...</p>
        )}

        {images.map((image, index) => {
          if (images.length === index + 1 && hasMore) {
              return <ImageCard
                        ref={lastImageElementRef}
                        key={image.id}
                        image={image}
                        onClick={handleImageClick}
                        isSelected={selectedImages.has(image.id)}
                        onContextMenu={(e) => handleContextMenu(e, image)}
                        refreshKey={image.refreshKey}
                      />;
          }
          return <ImageCard
                    key={image.id}
                    image={image}
                    onClick={handleImageClick}
                    isSelected={selectedImages.has(image.id)}
                    onContextMenu={(e) => handleContextMenu(e, image)}
                    refreshKey={image.refreshKey}
                  />;
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

      {isModalOpen && selectedImage && (
        <ImageModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          currentImage={selectedImage}
          images={images} // Pass the entire image list for navigation
          onNavigate={handleModalNavigate} // Callback for next/prev buttons in modal
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}
      <ContextMenu
        isOpen={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        thumbnailData={contextMenu.thumbnailData}
        onMenuItemClick={handleMenuItemClick}
        setContextMenu={setContextMenu}
      />
    </>
  );
}

export default ImageGrid; // Export as ImageGrid
