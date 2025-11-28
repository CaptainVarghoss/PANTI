import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImageCard from '../components/ImageCard';
import { motion, AnimatePresence } from 'framer-motion';
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
  setWebSocketMessage,
  isSelectMode,
  setIsSelectMode,
  selectedImages,
  handleMoveSelected,
  handleMoveSingleImage,
  setSelectedImages,
  trash_only = false,
  contextMenuItems,
  openModal,
}) {
  const { token, isAuthenticated, settings } = useAuth();
  const [imagesLoading, setImagesLoading] = useState(true); // For initial load state
  const [imagesError, setImagesError] = useState(null);
  const [lastId, setLastId] = useState(null); // Cursor for pagination: ID of the last image fetched
  const [lastSortValue, setLastSortValue] = useState(null);
  const [hasMore, setHasMore] = useState(true); // True if there are more images to load
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Tracks if a fetch for more images is in progress

  const [focusedImageId, setFocusedImageId] = useState(null);
  const [contextMenu, setContextMenu] = useState({
      isVisible: false,
      x: 0,
      y: 0,
      thumbnailData: null, // Data of the thumbnail that was right-clicked
    });

  const lastIdRef = useRef(lastId);
  const gridRef = useRef(null); // Ref for the grid container

  // Variants for the container
  const gridContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05, // Stagger the animation of children
      },
    },
  };

  // Variants for each image card
  const imageCardVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  };


  const lastSortValueRef = useRef(lastSortValue);
  useEffect(() => {
    lastIdRef.current = lastId;
    lastSortValueRef.current = lastSortValue;
  }, [lastId, lastSortValue]);

  // Get imagesPerPage from settings, default to 60 if not available or invalid
  const imagesPerPage = parseInt(settings.thumb_num) || 60;

  const getFocusedImage = useCallback(() => {
    return images.find(img => img.id === focusedImageId);
  }, [images, focusedImageId]);

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
    setFocusedImageId(image.id); // Set focus on click
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
  }, [isSelectMode, openModal, images, setSearchTerm, setSelectedImages]);

  // Handle right-click event on a thumbnail
  const handleContextMenu = (event, thumbnail) => {
    event.preventDefault(); // Prevent default browser context menu
    setContextMenu({
        isVisible: true,
        x: event.clientX,
        y: event.clientY,
        thumbnailData: thumbnail,
    });

    // Also set focus on right-click
    setFocusedImageId(thumbnail.id);

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
        case 'move':
            if (handleMoveSingleImage) handleMoveSingleImage(data.id);
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
        activeContextMenuItems = [
            { label: "Select", action: "select" },
            { label: "Edit Tags", action: "add_tag" },
            { label: "Move", action: "move" },
            { label: "Delete", action: "delete" }
        ];
    }
  }

  // Clear selection when exiting select mode
  useEffect(() => {
    if (!isSelectMode) {
      setSelectedImages(new Set());
    }
  }, [isSelectMode]);

  // Effect for closing the image modal with Space or Enter
  useEffect(() => {
    const handleModalKeyDown = (e) => {
      // Check if the image modal is open by looking for its specific content
      const imageModal = document.querySelector('.modal-image-section');

      if (imageModal && (e.key === ' ' || e.key === 'Enter')) {
        // Prevent the default action (like scrolling on space)
        e.preventDefault();
        
        // Find the close button and click it programmatically
        const closeButton = document.querySelector('.modal-close-button');
        if (closeButton) {
          closeButton.click();
        }
      }
    };

    document.addEventListener('keydown', handleModalKeyDown);
    return () => document.removeEventListener('keydown', handleModalKeyDown);
  }, []); // Empty dependency array ensures this runs only once

  // Effect for handling keyboard navigation
  useEffect(() => {
    const getColumns = () => {
      if (!gridRef.current) return 5; // Default fallback
      const gridStyle = window.getComputedStyle(gridRef.current);
      const gridTemplateColumns = gridStyle.getPropertyValue('grid-template-columns');
      return gridTemplateColumns.split(' ').length;
    };

    const handleKeyDown = (e) => {
      // Don't interfere with input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (!images || images.length === 0) return;

      let currentIndex = -1;
      if (focusedImageId !== null) {
        currentIndex = images.findIndex(img => img.id === focusedImageId);
      } else {
        // If no image is focused, focus the first one on key press
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
          setFocusedImageId(images[0].id);
        }
        return;
      }

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      const columns = getColumns();

      switch (e.key) {
        case 'ArrowLeft':
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          nextIndex = Math.min(images.length - 1, currentIndex + 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(0, currentIndex - columns);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(images.length - 1, currentIndex + columns);
          break;
        case ' ': // Spacebar
        case 'Enter':
          e.preventDefault();
          const focusedImage = getFocusedImage();
          if (focusedImage) {
            handleImageClick(focusedImage);
          }
          return; // Don't update focus, let the modal open
        default:
          return; // Ignore other keys
      }

      if (nextIndex !== currentIndex) {
        e.preventDefault();
        const nextImage = images[nextIndex];
        if (nextImage) {
          setFocusedImageId(nextImage.id);
          // Scroll the new focused image into view
          const cardElement = document.querySelector(`[data-image-id="${nextImage.id}"]`);
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [images, focusedImageId, getFocusedImage, handleImageClick]);


  // Fetch images function, now accepting an optional cursor (last_id)
  const fetchImages = useCallback(async (isInitialLoad) => {
    // The guard against re-fetching is now handled by the callers.
    // This function is now only responsible for the API call itself.

    if (isInitialLoad) {
      setImagesLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    setImagesError(null);

    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const limit = isInitialLoad ? imagesPerPage * 2 : imagesPerPage;

      const queryString = new URLSearchParams();
      queryString.append('limit', limit);
      queryString.append('sort_by', sortBy);
      queryString.append('sort_order', sortOrder);

      if (searchTerm) {
        queryString.append('search_query', searchTerm);
      }

      // Use refs for cursors in subsequent loads
      if (!isInitialLoad && lastIdRef.current) {
        queryString.append('last_id', lastIdRef.current);
      }
      if (!isInitialLoad && lastSortValueRef.current) {
        queryString.append('last_sort_value', lastSortValueRef.current);
      }

      if (trash_only) {
        queryString.append('trash_only', 'true');
      }

      if (filters) {
        const activeStages = {};
        filters.forEach(filter => {
          if (filter.activeStageIndex !== -1) activeStages[filter.id] = filter.activeStageIndex;
        });
        if (Object.keys(activeStages).length > 0) queryString.append('active_stages_json', JSON.stringify(activeStages));
      }

      const response = await fetch(`/api/images/?${queryString.toString()}`, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Details:', response.status, response.statusText, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (isInitialLoad) {
        setImages(data);
      } else {
        setImages(prevImages => {
          const existingIds = new Set(prevImages.map(img => img.id));
          const uniqueNewImages = data.filter(img => !existingIds.has(img.id));
          return [...prevImages, ...uniqueNewImages];
        });
      }

      if (data.length > 0) {
        const newLastImage = data[data.length - 1];
        setLastId(newLastImage.id);
        let valForSort = newLastImage[sortBy];
        if (sortBy === 'date_created') {
          valForSort = new Date(valForSort).toISOString();
        }
        setLastSortValue(valForSort);
      } else {
        setLastId(null);
        setLastSortValue(null);
      }

      setHasMore(data.length === limit);

    } catch (error) {
      console.error('Error fetching images:', error);
      setImagesError('Failed to load images. Ensure backend scanner has run and images exist, and you are logged in if required.');
      setHasMore(false);
    } finally {
      setImagesLoading(false);
      setIsFetchingMore(false);
    }
  }, [token, imagesPerPage, sortBy, sortOrder, searchTerm, filters, trash_only, setImages]); // Dependencies are now correct and stable

  // Effect for initial page load and when search/sort parameters change
  useEffect(() => {
    if (searchTerm === null) {
      setImages([]);
      setImagesLoading(false);
      return;
    }

    if (isAuthenticated && imagesPerPage > 0) {
      // Reset cursors and trigger a new initial load
      setLastId(null);
      setLastSortValue(null);
      setHasMore(true);
      fetchImages(true); // `true` indicates it's an initial load
    } else if (!isAuthenticated) {
      setImages([]);
      setImagesLoading(false);
      setIsFetchingMore(false);
      setHasMore(false);
      setLastId(null);
      setLastSortValue(null);
      setImagesError("Please log in to view images.");
    }
  }, [isAuthenticated, imagesPerPage, searchTerm, sortBy, sortOrder, filters, trash_only, fetchImages]);

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
      } else { // Handle general refresh (image_added, images_moved, etc.)
        console.log("WebSocket: Received general refresh_images message. Merging new images into grid.");

        // Fetch the first page of images in the background without clearing the current view
        const fetchUpdatedImageList = async () => {
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const queryString = new URLSearchParams();
          // Fetch a list of the same size as the currently loaded images to accurately determine removals.
          // Ensure we fetch at least one page's worth of images.
          queryString.append('limit', Math.max(images.length, imagesPerPage));
          queryString.append('sort_by', sortBy);
          queryString.append('sort_order', sortOrder);
          if (searchTerm) queryString.append('search_query', searchTerm);
          if (trash_only) queryString.append('trash_only', 'true');
          if (filters) {
            const activeStages = {};
            filters.forEach(filter => {
              if (filter.activeStageIndex !== -1) activeStages[filter.id] = filter.activeStageIndex;
            });
            if (Object.keys(activeStages).length > 0) queryString.append('active_stages_json', JSON.stringify(activeStages));
          }

          try {
            const response = await fetch(`/api/images/?${queryString.toString()}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch updated images');
            const newImages = await response.json();

            setImages(prevImages => {
              const newImageIds = new Set(newImages.map(img => img.id));

              // Combine new images with previous images to get a complete list.
              // Place new images first to ensure they appear at the top if the sort order dictates.
              const combined = [...newImages, ...prevImages];

              // Use a Map to ensure uniqueness, preserving the order from the combined array.
              // The first occurrence of an image (from `newImages`) will be kept.
              const uniqueImages = Array.from(new Map(combined.map(item => [item.id, item])).values());

              // Filter this unique list to only include images that are present in the latest fetch.
              // This correctly removes images that have been filtered out, while preserving the order of the rest.
              return uniqueImages.filter(img => newImageIds.has(img.id));
            });
          } catch (error) {
            console.error("Error fetching images for WebSocket merge:", error);
          }
        };

        fetchUpdatedImageList();
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

    // Clear the message after processing to prevent re-triggering
    setWebSocketMessage(null);
  }, [webSocketMessage, searchTerm, sortBy, sortOrder, fetchImages]);

  // Ref for the element to observe for infinite scrolling
  const observer = useRef();
  const lastImageElementRef = useCallback(node => {
    // If we are currently loading, or there are no more images, do nothing.
    if (imagesLoading || isFetchingMore) return;

    // Disconnect any existing observer before creating a new one.
    if (observer.current) observer.current.disconnect();

    // If there are no more images to load, we don't need an observer.
    if (!hasMore) {
      return;
    }

    // Create a new IntersectionObserver instance
    observer.current = new IntersectionObserver(entries => {
      // If the observed element is intersecting, trigger the next fetch.
      // The guards inside the callback prevent re-fetching.
      if (entries[0].isIntersecting) {
        fetchImages(false); // `false` indicates it's a subsequent load
      }
    }, {
      root: null, // Use the viewport as the root element
      rootMargin: '100px', // When the target element is 100px from the bottom of the viewport, trigger the callback
      threshold: 0.1 // Trigger when 10% of the target element is visible
    }); 

    // Start observing the provided DOM node if it exists
    if (node) {
      observer.current.observe(node);
    }
  }, [imagesLoading, isFetchingMore, hasMore, fetchImages]); // The dependency array is now minimal and correct.

  return (
    <>
      <motion.div
        layout
        ref={gridRef}
        className={`image-grid ${isSelectMode ? 'select-mode' : ''}`}
        variants={gridContainerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {images.map((image, index) => (
            <motion.div
              layout
              key={image.id}
              variants={imageCardVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <ImageCard
                ref={images.length === index + 1 && hasMore ? lastImageElementRef : null}
                image={image}
                onClick={handleImageClick}
                isSelected={selectedImages.has(image.id)}
                onContextMenu={(e) => handleContextMenu(e, image)}
                isFocused={focusedImageId === image.id}
                refreshKey={image.refreshKey} />
            </motion.div>
          ))}
        </AnimatePresence>

        {imagesError && <p>{imagesError}</p>}

        {imagesLoading && images.length === 0 && !imagesError && <p>Loading images...</p>}

        {isFetchingMore && <p>Loading more images...</p>}

        {!imagesLoading && !isFetchingMore && images.length === 0 && !imagesError && (
          <p>No images found. Add some to your configured paths and run the scanner!</p>
        )}
      </motion.div>

      <ContextMenu
        isOpen={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        thumbnailData={contextMenu.thumbnailData}
        onMenuItemClick={handleMenuItemClick}
        setContextMenu={setContextMenu}
        menuItems={activeContextMenuItems}
        images={images}
      />

    </>
  );
}

export default ImageGrid; // Export as ImageGrid
