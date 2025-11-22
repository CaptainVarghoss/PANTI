import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImageCard from '../components/ImageCard';
import ContextMenu from './ContextMenu';
import { useAuth } from '../context/AuthContext'; // To get token and settings for authenticated calls

/**
 * Component to display the image gallery with infinite scrolling using cursor-based pagination.
 * Fetches image data from the backend in pages and appends them.
 */
function ImageGrid({
  images,
  setImages,
  searchTerm,
  setSearchTerm,
  sortBy,
  sortOrder,
  filters,
  webSocketMessage,
  isSelectMode,
  setIsSelectMode,
  selectedImages,
  handleMoveSelected,
  setSelectedImages,
  trash_only = false,
  contextMenuItems,
  openModal
}) {
  const { token, isAuthenticated, settings } = useAuth();
  const [imagesLoading, setImagesLoading] = useState(true); // For initial load state
  const [imagesError, setImagesError] = useState(null);
  const [lastId, setLastId] = useState(null); // Cursor for pagination: ID of the last image fetched
  const [lastSortValue, setLastSortValue] = useState(null);
  const [hasMore, setHasMore] = useState(true); // True if there are more images to load
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Tracks if a fetch for more images is in progress

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
      openModal('image', {
        currentImage: image,
        images: images,
        onNavigate: (nextImage) => openModal('image', { // Re-open modal with new image
          currentImage: nextImage,
          images: images,
          onNavigate: (img) => openModal('image', { currentImage: img, images, onNavigate }),
          setSearchTerm: setSearchTerm
        }),
        setSearchTerm: setSearchTerm
      });
    }
  }, [isSelectMode, openModal, images, setSearchTerm]);

  // Handle right-click event on a thumbnail
  const handleContextMenu = (event, thumbnail) => {
    event.preventDefault(); // Prevent default browser context menu
    setContextMenu({
        isVisible: true,
        x: event.clientX,
        y: event.clientY,
        thumbnailData: thumbnail,
    });

    // If the right-clicked image is not already in the selection,
    // add it to the selection. This makes the context menu feel more intuitive.
    if (isSelectMode && !selectedImages.has(thumbnail.id)) {
      setSelectedImages(prevSelected => {
        const newSelected = new Set(prevSelected);
        newSelected.add(thumbnail.id);
        return newSelected;
      });
    }
  };

  // Close the context menu
  const handleCloseContextMenu = () => {
      setContextMenu({ ...contextMenu, isVisible: false });
  };

  // Handle click on a context menu item
  const handleMenuItemClick = (action, data) => {
      console.log(`Action: ${action} on Thumbnail ID: ${data.id}`);

      const markImageAsDeleted = async (imageId) => {
        try {
          const headers = { 'Authorization': `Bearer ${token}` };
          const response = await fetch(`/api/images/${imageId}/delete`, {
            method: 'POST',
            headers,
          });
    
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
          }
    
          // On success, remove the image from the local state to update the UI instantly
          setImages(prevImages => prevImages.filter(img => img.id !== imageId));
        } catch (error) {
          console.error(`Error marking image ${imageId} as deleted:`, error);
          // Optionally, show an error message to the user
        }
      };

      const restoreImage = async (imageId) => {
        try {
          const headers = { 'Authorization': `Bearer ${token}` };
          const response = await fetch(`/api/images/${imageId}/restore`, {
            method: 'POST',
            headers,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
          }

          // On success, remove the image from the local trash view state
          setImages(prevImages => prevImages.filter(img => img.id !== imageId));
        } catch (error) {
          console.error(`Error restoring image ${imageId}:`, error);
          alert(`Error restoring image: ${error.message}`);
        }
      };

      const deleteImagePermanently = async (imageId) => {
        if (!window.confirm("Are you sure you want to permanently delete this image? This action cannot be undone.")) return;

        try {
          const headers = { 'Authorization': `Bearer ${token}` };
          const response = await fetch(`/api/images/${imageId}/permanent`, {
            method: 'DELETE',
            headers,
          });

          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

          setImages(prevImages => prevImages.filter(img => img.id !== imageId));
        } catch (error) {
          console.error(`Error permanently deleting image ${imageId}:`, error);
          alert(`Error permanently deleting image: ${error.message}`);
        }
      };

      const deleteSelectedImages = async () => {
        const imageIds = Array.from(selectedImages);
        if (imageIds.length === 0) return;

        try {
          const response = await fetch('/api/images/delete-bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(imageIds),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to move images to trash.');
          }

          // UI updates via websocket, just clear selection
          setSelectedImages(new Set());
        } catch (error) {
          console.error("Error during bulk delete from context menu:", error);
          alert(`Error: ${error.message}`);
        }
      };

      const restoreSelectedImages = async () => {
          const imageIds = Array.from(selectedImages);
          if (imageIds.length === 0) return;

          try {
              const response = await fetch('/api/trash/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify(imageIds),
              });
              if (!response.ok) throw new Error('Failed to restore images.');
              setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
              setSelectedImages(new Set());
          } catch (error) {
              alert(`Error: ${error.message}`);
          }
      };

      const deleteSelectedPermanently = async () => {
          const imageIds = Array.from(selectedImages);
          if (imageIds.length === 0) return;

          if (window.confirm(`Are you sure you want to PERMANENTLY delete ${imageIds.length} selected image(s)? This cannot be undone.`)) {
              try {
                  const response = await fetch('/api/trash/delete-permanent', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify(imageIds),
                  });
                  if (!response.ok) throw new Error('Failed to permanently delete images.');
                  setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
                  setSelectedImages(new Set());
              } catch (error) {
                  alert(`Error: ${error.message}`);
              }
          }
      };

      // Implement specific logic based on the action
      switch (action) {
        case 'select':
            setIsSelectMode(true);
            setSelectedImages(new Set([data.id]));
            break;
        case 'delete':
            markImageAsDeleted(data.id);
            break;
        case 'restore':
            restoreImage(data.id);
            break;
        case 'delete_permanent':
            deleteImagePermanently(data.id);
            break;
        case 'delete_selected':
            deleteSelectedImages();
            break;
        case 'move_selected':
            if (handleMoveSelected) handleMoveSelected();
            break;
        case 'restore_selected':
            restoreSelectedImages();
            break;
        case 'delete_permanent_selected':
            deleteSelectedPermanently();
            break;
        default:
            break;
      }
  };

  // Determine which menu items to show based on the current mode
  let activeContextMenuItems;
  if (isSelectMode) {
    if (trash_only) {
        activeContextMenuItems = [
            { label: `Restore ${selectedImages.size} Selected`, action: "restore_selected" },
            { label: `Delete ${selectedImages.size} Permanently`, action: "delete_permanent_selected" },
        ];
    } else {
        activeContextMenuItems = [
            { label: `Delete ${selectedImages.size} Selected`, action: "delete_selected" },
            { label: `Move ${selectedImages.size} Selected`, action: "move_selected" },
        ];
    }
  } else {
    // Not in select mode, use single-item actions
    if (contextMenuItems) { // If custom items are passed (like in TrashView)
        activeContextMenuItems = [{ label: "Select", action: "select" }, ...contextMenuItems];
    } else { // Default for main grid
        activeContextMenuItems = [ { label: "Select", action: "select" }, { label: "Delete", action: "delete" } ];
    }
  }

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

      if (trash_only) {
        queryString.append('trash_only', 'true');
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

  // Effect for handling WebSocket messages
  useEffect(() => {
    if (!webSocketMessage) return;

    const { type, reason, image_id, image_ids } = webSocketMessage;

    if (type === 'refresh_images') {
      if (reason === 'thumbnail_generated' && image_id) {
        // This is a targeted update for a specific thumbnail.
        console.log(`WebSocket: Received thumbnail generated notification for image ${image_id}. Refreshing card.`);
        setImages(prevImages => 
          prevImages.map(img => 
            img.id === image_id 
              ? { ...img, refreshKey: new Date().getTime() } // Update refreshKey to trigger re-render in ImageCard
              : img
          )
        );
      } else {
        // This is a general refresh (e.g., for a new image added). Refetch the first page.
        console.log("WebSocket: Received general refresh_images message. Refetching first page.");
        // This will replace the current images with the most up-to-date list from the server,
        // automatically including new images and excluding ones that no longer match the filter.
        fetchImages(null, null, searchTerm, sortBy, sortOrder);
      }

    } else if (type === 'image_deleted') {
      if (!image_id) {
        console.error("WebSocket message of type 'image_deleted' did not contain an 'image_id'.");
        return;
      }
      console.log("Removing image from grid from WebSocket:", image_id);
      setImages(prevImages => prevImages.filter(img => img.id !== image_id));
    } else if (type === 'images_deleted') {
      if (!image_ids || !Array.isArray(image_ids)) {
        console.error("WebSocket message of type 'images_deleted' did not contain an 'image_ids' array.");
        return;
      }
      console.log("Removing multiple images from grid via WebSocket:", image_ids);
      const idsToRemove = new Set(image_ids);
      setImages(prevImages => prevImages.filter(img => !idsToRemove.has(img.id)));
    }
  }, [webSocketMessage, searchTerm, sortBy, sortOrder, fetchImages]);

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
  }, [isAuthenticated, imagesPerPage, searchTerm, sortBy, sortOrder, fetchImages, filters, trash_only]);
  
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
  }, [imagesLoading, isFetchingMore, hasMore, fetchImages, searchTerm, sortBy, sortOrder, trash_only]);

  return (
    <>
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
          <p className="">No images found. Add some to your configured paths and run the scanner!</p>
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        thumbnailData={contextMenu.thumbnailData}
        onMenuItemClick={handleMenuItemClick}
        setContextMenu={setContextMenu}
        menuItems={activeContextMenuItems}
      />
    </>
  );
}

export default ImageGrid; // Export as ImageGrid
