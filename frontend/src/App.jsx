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
  const { isAuthenticated, loading, token } = useAuth();
  // States for search and sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [webSocketMessage, setWebSocketMessage] = useState(null);
  const [currentView, setCurrentView] = useState('grid');

  // Callback to handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    console.log("File change detected:", message);
    setWebSocketMessage(message);
  }, []);

  // WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const websocketUrl = `${protocol}//localhost:8000/ws/image-updates`;
  const { isConnected } = useWebSocket(isAuthenticated ? websocketUrl : null, handleWebSocketMessage);

  
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
            />
            <ConnectionStatus />
            {currentView === 'grid' && (
              <ImageGrid
                searchTerm={searchTerm}
                sortBy={sortBy}
                sortOrder={sortOrder}
                setSearchTerm={setSearchTerm}
                webSocketMessage={webSocketMessage}
                filters={filters}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
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