import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom'; // Keep for potential future routing needs
import { useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid"; // Assuming ImageGrid is now a page component
import TrashView from './components/TrashView';
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
  const [trashImages, setTrashImages] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [selectedImages, setSelectedImages] = useState(new Set());

  const handleSetCurrentView = (view) => {
    // When the view changes, exit select mode and clear the selection
    if (currentView !== view) {
        setIsSelectMode(false);
        setSelectedImages(new Set());
    }
    setCurrentView(view);
  };


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

  // Effect to fetch trash count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTrashCount = async () => {
      try {
        const response = await fetch('/api/trash/info', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch trash count');
        const data = await response.json();
        setTrashCount(data.item_count);
      } catch (error) {
        console.error("Error fetching trash count:", error);
      }
    };

    fetchTrashCount();
  }, [isAuthenticated, token, webSocketMessage, debouncedSearchTerm]); // Also refetch on search change

  const handleMoveSelected = () => {
    // Placeholder for move functionality
    alert(`Move action for ${selectedImages.size} images is not yet implemented.`);
  };

  const handleTrashBulkAction = async (action) => {
    const imageIds = Array.from(selectedImages);
    if (imageIds.length === 0) return;

    let endpoint = '';
    let confirmMessage = '';

    if (action === 'restore') {
        endpoint = '/api/trash/restore';
        confirmMessage = `Are you sure you want to restore ${imageIds.length} image(s)?`;
    } else if (action === 'delete_permanent') {
        endpoint = '/api/trash/delete-permanent';
        confirmMessage = `Are you sure you want to PERMANENTLY delete ${imageIds.length} selected image(s)? This action cannot be undone.`;
    }

    if (!window.confirm(confirmMessage)) return;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(imageIds),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to ${action} images.`);
        }

        // The view will update via websocket, just clear selection.
        setSelectedImages(new Set());
    } catch (error) {
        console.error(`Error during bulk ${action}:`, error);
        alert(`Error: ${error.message}`);
    }
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
              setCurrentView={handleSetCurrentView}
              selectedImages={selectedImages}
              setSelectedImages={setSelectedImages}
              trashCount={trashCount}
              setTrashCount={setTrashCount}
              images={currentView === 'trash' ? trashImages : images}
              onTrashBulkAction={handleTrashBulkAction}
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
                handleMoveSelected={handleMoveSelected}
              />
            )}
            {currentView === 'trash' && (
              <TrashView
                images={trashImages}
                setImages={setTrashImages}
                webSocketMessage={webSocketMessage}
                setTrashCount={setTrashCount}
                setCurrentView={handleSetCurrentView}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
                selectedImages={selectedImages}
                setSelectedImages={setSelectedImages}
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