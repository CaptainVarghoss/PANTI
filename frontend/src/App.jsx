import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid"; // Assuming ImageGrid is now a page component
import Login from './pages/Login';
import Signup from './pages/Signup';
import Navbar from './components/Navbar'; // Import Navbar from its own file
import SideBar from './components/SideBar'; // Import SideBar
import { useWebSocket } from './hooks/useWebSocket'; // Import the custom hook

import './App.css';

/**
 * Route protector for public-only pages (e.g., login, signup).
 * Redirects to the home page (/) if the user is already authenticated.
 */
const PublicOnlyRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // Show a loading indicator while authentication status is being determined
  if (loading) {
    return (
      <div className="loading-full-page">
        Loading authentication...
      </div>
    );
  }

  // If already authenticated, redirect to home page
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

/**
 * Route protector for private (authenticated) pages.
 * Redirects to the login page (/login) if the user is not authenticated.
 */
const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // Show a loading indicator while authentication status is being determined
  if (loading) {
    return (
      <div className="loading-full-page">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * Route protector for admin-only pages.
 * Redirects to home (/) if not authenticated or not an admin.
 */
const AdminRoute = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-full-page">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login
  // If authenticated but not an admin, redirect to home (or a dedicated forbidden page)
  return isAuthenticated && isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

/**
 * Component to handle logout.
 * It calls the logout function from AuthContext and then redirects.
 */
const LogoutPage = () => {
  const { logout } = useAuth();
  const navigate = useNavigate(); // Import useNavigate for redirection

  useEffect(() => {
    logout(); // Perform the logout action
    navigate('/login', { replace: true }); // Redirect to login page after logout
  }, [logout, navigate]); // Depend on logout and navigate to ensure effect runs correctly

  return (
    <div className="loading-full-page">
      Logging out...
    </div>
  );
};

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
    <div style={{ position: 'fixed', bottom: '10px', right: '10px', padding: '5px 10px', backgroundColor: isConnected ? '#28a745' : '#dc3545', color: 'white', borderRadius: '5px', zIndex: 1000, fontSize: '0.8em' }}>
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );

  // Callback to update search and sort states from NavSearchBar
  const handleSearchAndSortChange = useCallback((newSearchTerm, newSortBy, newSortOrder) => {
      setSearchTerm(newSearchTerm);
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
  }, []);

  // Filter states
  const [filters, setFilters] = useState([]);

  // States for Sidebars
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [currentSubPanel, setCurrentSubPanel] = useState('menu');

  // Toggle functions for sidebars, ensuring only one is open at a time
  const toggleLeftSidebar = () => {
    setIsLeftSidebarOpen(!isLeftSidebarOpen);
    if (isRightSidebarOpen) setIsRightSidebarOpen(false); // Close right if opening left
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(!isRightSidebarOpen);
    if (isLeftSidebarOpen) setIsLeftSidebarOpen(false); // Close left if opening right
  };

  // Function to close both sidebars
  const closeAllSidebars = () => {
    setIsLeftSidebarOpen(false);
    setIsRightSidebarOpen(false);
  };

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
      {isAuthenticated &&
        <>
          <Navbar
            toggleLeftSidebar={toggleLeftSidebar}
            toggleRightSidebar={toggleRightSidebar}
            searchTerm={searchTerm}
            onSearchAndSortChange={handleSearchAndSortChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
            setSearchTerm={setSearchTerm}
            filters={filters}
            setFilters={setFilters}
          />
          <ConnectionStatus />
          <SideBar
            isOpen={isLeftSidebarOpen}
            onClose={closeAllSidebars}
            side="left"
            subPanel={currentSubPanel}
            setSubPanel={setCurrentSubPanel}
            onSearchAndSortChange={handleSearchAndSortChange}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}            
            filters={filters}
            setFilters={setFilters}
          />
          <SideBar
            isOpen={isRightSidebarOpen}
            onClose={closeAllSidebars}
            side="right"
            subPanel={currentSubPanel}
            setSubPanel={setCurrentSubPanel}
            onSearchAndSortChange={handleSearchAndSortChange}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}            
            filters={filters}
            setFilters={setFilters}
          />
        </>
      }
      <div className="app-content"> {/* Main content area where routes are rendered */}
        <Routes>

          {/* Public only routes (e.g., login, signup). Redirects if already authenticated. */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* Protected Routes (accessible only if isAuthenticated) */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={
              <ImageGrid
                searchTerm={searchTerm}
                sortBy={sortBy}
                sortOrder={sortOrder}
                setSearchTerm={setSearchTerm}
                webSocketMessage={webSocketMessage}
                filters={filters}
              />
            } />
          </Route>
          {/* Catch-all route for any undefined paths. */}
          {/* If authenticated, navigates to home (/). If not, navigates to login (/login). */}
          <Route path="*" element={<HomeOrLoginRedirect />} />
        </Routes>
      </div>
    </Router>
  );
}

// Helper component for the catch-all route
const HomeOrLoginRedirect = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-full-page">
        Loading authentication...
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/login" replace />;
};

export default App;