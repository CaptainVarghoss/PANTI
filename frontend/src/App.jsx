import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom'; // Keep for potential future routing needs
import { useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid"; // Assuming ImageGrid is now a page component
import UnauthenticatedApp from './components/UnauthenticatedApp'; // Import the new component
import Navbar from './components/Navbar'; // Import Navbar from its own file
import { useWebSocket } from './hooks/useWebSocket'; // Import the custom hook

import './App.css';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function App() {
  const { isAuthenticated, loading, token, isAdmin } = useAuth();
  // States for search and sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [webSocketMessage, setWebSocketMessage] = useState(null);
  const [currentView, setCurrentView] = useState('grid');
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState(new Set());


  // Callback to handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    console.log("File change detected:", message);
    setWebSocketMessage(message);
  }, []);

  // WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const websocketUrl = `${protocol}//${window.location.hostname}:8000/ws/image-updates`;
  const { isConnected } = useWebSocket(isAuthenticated ? websocketUrl : null, token, isAdmin, handleWebSocketMessage);

  
  const ConnectionStatus = () => (
    <div style={{ position: 'fixed', top: '0.2rem', left: '0', height: '2.5rem', width: '0.1rem', border: '0.1rem solid', borderColor: isConnected ? '#28a745' : '#dc3545', backgroundColor: isConnected ? '#28a745' : '#dc3545', zIndex: 1000}}>
    </div>
  );
  
  // States for select mode
  const [isSelectMode, setIsSelectMode] = useState(false);


  // Callback to update search and sort states from NavSearchBar
  const handleSearchAndSortChange = useCallback((newSearchTerm, newSortBy, newSortOrder) => {
      setSearchTerm(newSearchTerm);
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
  }, []);

  // Filter states
  const [filters, setFilters] = useState([]);

  const debouncedSearchTerm = useDebounce(searchTerm, 500); // Debounce search input by 500ms

  // Effect to call the parent's callback when debounced search term or sort options change
  useEffect(() => {
      // Only call if the callback exists and is a function
      if (typeof handleSearchAndSortChange === 'function') {
          handleSearchAndSortChange(debouncedSearchTerm, sortBy, sortOrder);
      }
  }, [debouncedSearchTerm, sortBy, sortOrder, handleSearchAndSortChange]);

  useEffect(() => {
    if (!isAuthenticated) { return }
    const fetchFilters = async () => {
        try {
            const response = await fetch('/api/filters/', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fetchedFilters = await response.json();
            // Initialize each filter with isSelected: false
            const initializedFilters = fetchedFilters.map(f => ({ ...f, isSelected: f.enabled || false }));
            setFilters(initializedFilters);
        } catch (error) {
            console.error(`Error fetching filters:`, error);
        }
    };
    fetchFilters();
  }, [isAuthenticated, token]);

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

  const handleMoveSelected = () => {
    // Placeholder for move functionality
    alert(`Move action for ${selectedImages.size} images is not yet implemented.`);
  };

  if (loading) {
    return (
      <div className="loading-full-page">
        Loading application...
      </div>
    );
  }

  return (
    <Router>
      <div className="app-content">
        {isAuthenticated ? (
          <>
            <Navbar
              searchTerm={searchTerm}
              onSearchAndSortChange={handleSearchAndSortChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              setSortBy={setSortBy}
              setSortOrder={setSortOrder}
              setSearchTerm={setSearchTerm}
              filters={filters}
              setFilters={setFilters}
              isConnected={isConnected}
              isSelectMode={isSelectMode}
              setIsSelectMode={setIsSelectMode}
              currentView={currentView}
              setCurrentView={setCurrentView}
              selectedImages={selectedImages}
              setSelectedImages={setSelectedImages}
              images={images}
              addTrashTagToImages={addTrashTagToImages}
              handleMoveSelected={handleMoveSelected}
            />
            <ConnectionStatus />
            {currentView === 'grid' && (
              <ImageGrid
                images={images}
                setImages={setImages}
                searchTerm={searchTerm}
                sortBy={sortBy}
                sortOrder={sortOrder}
                setSearchTerm={setSearchTerm}
                webSocketMessage={webSocketMessage}
                filters={filters}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
                selectedImages={selectedImages}
                setSelectedImages={setSelectedImages}
                addTrashTagToImages={addTrashTagToImages}
                handleMoveSelected={handleMoveSelected}
              />
            )}
          </>
        ) : (
          <UnauthenticatedApp />
        )}
      </div>
    </Router>
  );
}

export default App;