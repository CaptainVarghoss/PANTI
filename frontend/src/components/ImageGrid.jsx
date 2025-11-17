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

  // --- Client-Side Search Parser ---
  // This is a simplified re-implementation of the backend's search_constructor.py
  // to ensure WebSocket images are filtered with the same logic.
  const clientSideSearchParser = useCallback((image, searchTerm) => {
    if (!searchTerm || !image) return true;

    // Tokenizer
    const tokenize = (query) => {
      const pattern = /("(?<dquote_phrase>[^"]*)"|'(?<squote_phrase>[^']*)'|\b(AND|OR|NOT)\b|([&|!()])|(?<keyword>TAG|FOLDER):|(?<word>[^\s"'\(\)&|!:]+))/gi;
      const tokens = [];
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const { dquote_phrase, squote_phrase, keyword, word } = match.groups;
        const operator = match[1]?.toUpperCase();
        const symbol = match[2];

        if (dquote_phrase !== undefined) tokens.push({ type: 'PHRASE', value: dquote_phrase });
        else if (squote_phrase !== undefined) tokens.push({ type: 'PHRASE', value: squote_phrase });
        else if (operator === 'AND' || symbol === '&') tokens.push({ type: 'AND' });
        else if (operator === 'OR' || symbol === '|') tokens.push({ type: 'OR' });
        else if (operator === 'NOT' || symbol === '!') tokens.push({ type: 'NOT' });
        else if (symbol === '(') tokens.push({ type: 'LPAREN' });
        else if (symbol === ')') tokens.push({ type: 'RPAREN' });
        else if (keyword) tokens.push({ type: 'KEYWORD', value: keyword.toUpperCase() });
        else if (word) tokens.push({ type: 'WORD', value: word });
      }
      return tokens;
    };

    // AST Builder (Recursive Descent Parser)
    let index = 0;
    const parse = (tokens) => {
      const parsePrimary = () => {
        const token = tokens[index];
        if (token.type === 'LPAREN') {
          index++;
          const node = parseExpression();
          index++; // Consume RPAREN
          return node;
        }
        if (token.type === 'NOT') {
          index++;
          return { type: 'NOT', operand: parsePrimary() };
        }
        if (token.type === 'KEYWORD') {
          index++; // consume keyword
          const valueToken = tokens[index++];
          return { type: 'KEYWORD', keyword: token.value, value: valueToken.value, valueType: valueToken.type };
        }
        index++;
        return { type: 'TERM', value: token.value };
      };

      const parseAnd = () => {
        let node = parsePrimary();
        while (index < tokens.length && tokens[index].type === 'AND') {
          index++;
          node = { type: 'AND', left: node, right: parsePrimary() };
        }
        return node;
      };

      const parseExpression = () => {
        let node = parseAnd();
        while (index < tokens.length && tokens[index].type === 'OR') {
          index++;
          node = { type: 'OR', left: node, right: parseAnd() };
        }
        return node;
      };

      return parseExpression();
    };

    // AST Evaluator
    const evaluate = (node) => {
      const imageExif = Object.values(image.exif_data || {}).join(' ').toLowerCase();
      const imagePath = image.path.toLowerCase();
      const imageTags = (image.tags || []).map(t => t.name.toLowerCase());

      switch (node.type) {
        case 'TERM':
          const term = node.value.toLowerCase();
          return imageExif.includes(term) || imagePath.includes(term) || imageTags.some(t => t.includes(term));
        case 'KEYWORD':
          const keywordValue = node.value.toLowerCase();
          if (node.keyword === 'TAG') {
            if (node.valueType === 'PHRASE') {
              return imageTags.includes(keywordValue); // Exact match for phrases
            }
            return imageTags.some(t => t.includes(keywordValue)); // Partial match for words
          }
          if (node.keyword === 'FOLDER') {
             if (node.valueType === 'PHRASE') {
              return imagePath === keywordValue; // Exact match for phrases
            }
            return imagePath.includes(keywordValue); // Partial match for words
          }
          return false;
        case 'NOT':
          return !evaluate(node.operand);
        case 'AND':
          return evaluate(node.left) && evaluate(node.right);
        case 'OR':
          return evaluate(node.left) || evaluate(node.right);
        default:
          return true;
      }
    };

    try {
      const tokens = tokenize(searchTerm);
      if (tokens.length === 0) return true;

      // Implicit AND logic: insert 'AND' tokens where missing
      const processedTokens = [];
      for (let i = 0; i < tokens.length; i++) {
        processedTokens.push(tokens[i]);
        if (i < tokens.length - 1) {
          const current = tokens[i];
          const next = tokens[i+1];
          const isCurrentOperand = ['WORD', 'PHRASE', 'RPAREN'].includes(current.type);
          const isNextOperand = ['WORD', 'PHRASE', 'LPAREN', 'NOT', 'KEYWORD'].includes(next.type);
          if (isCurrentOperand && isNextOperand) {
            processedTokens.push({ type: 'AND' });
          }
        }
      }

      const ast = parse(processedTokens);
      return evaluate(ast);
    } catch (e) {
      console.error("Client-side search parsing error:", e);
      return true; // Fail open, show the image if parsing fails
    }
  }, []);

  // Function to check if an image matches the current search and filter criteria
  const doesImageMatchCriteria = useCallback((image, currentSearchTerm, activeFilters) => {
    if (!image) return false;

    // 1. Check against search term
    if (currentSearchTerm) {
      const lowercasedSearch = currentSearchTerm.toLowerCase();
      if (!image.filename.toLowerCase().includes(lowercasedSearch)) {
        return false; // Does not match search term
      }
    }

    // 2. Check against active filters
    const filtersToApply = activeFilters.filter(f => {
      // This logic mirrors the backend's `generate_image_search_filter`.
      // A filter's search terms should be applied if:
      // 1. It's a "show" filter (`reverse: false`) and it IS selected by the user.
      // 2. It's a "hide" filter (`reverse: true`) and it is NOT selected by the user.
      //    (The default explicit filter is `reverse: true` and `enabled: true`).
      if (f.reverse) {
        return f.isSelected; // Apply "hide" filters when they are NOT selected.
      }
      return !f.isSelected; // Apply "show" filters only when they ARE selected.
    });

    const combinedFilterSearchTerms = filtersToApply
      .map(f => f.search_terms)
      .filter(Boolean)
      .join(' ');

    // Combine user search with filter search terms
    const finalSearchQuery = [currentSearchTerm, combinedFilterSearchTerms].filter(Boolean).join(' ');

    if (!clientSideSearchParser(image, finalSearchQuery)) {
      return false;
    }

    // If we get here, the image passes all checks
    return true;
  }, [clientSideSearchParser]);

  useEffect(() => {
    if (!webSocketMessage) return;

    const { type } = webSocketMessage;

    if (type === 'image_added') {
      const { image } = webSocketMessage;
      if (!image) {
        console.error("WebSocket message of type 'image_added' did not contain an 'image' object.");
        return;
      }

      // Check if the new image matches the current search/filter criteria
      if (doesImageMatchCriteria(image, searchTerm, filters || [])) {
        setImages(prevImages => {
          const exists = prevImages.some(img => img.id === image.id);
          if (!exists) {
            console.log("Adding new image to grid from WebSocket:", image.id);
            // Add the new image to the start of the grid.
            return [image, ...prevImages];
          }
          return prevImages; // Return existing state if image is already there
        });
      } else {
        console.log(`New image ${image.id} received via WebSocket but does not match current criteria. Ignoring.`);
      }

    } else if (type === 'thumbnail_generated') {
      const { image } = webSocketMessage;
      if (!image) {
        console.error("WebSocket message of type 'thumbnail_generated' did not contain an 'image' object.");
        return;
      }

      console.log("Updating thumbnail from WebSocket for image:", image.id);
      setImages(prevImages => {
        return prevImages.map(img =>
          img.id === image.id
            ? { ...img, refreshKey: new Date().getTime() } // Trigger a re-render of the ImageCard
            : img
        );
      });

    } else if (type === 'image_deleted') {
      const { image_id } = webSocketMessage;
      if (!image_id) {
        console.error("WebSocket message of type 'image_deleted' did not contain an 'image_id'.");
        return;
      }

      console.log("Removing image from grid from WebSocket:", image_id);
      setImages(prevImages => prevImages.filter(img => img.id !== image_id));
    }

  }, [webSocketMessage, searchTerm, filters, doesImageMatchCriteria, clientSideSearchParser]);

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
