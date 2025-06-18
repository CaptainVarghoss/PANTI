// frontend/src/App.jsx

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid"; // Assuming ImageGrid is now a page component
import Login from './pages/Login';
import Signup from './pages/Signup';
import Navbar from './components/Navbar'; // Import Navbar from its own file
import SideBar from './components/SideBar'; // Import SideBar

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

function App() {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

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

  return (
    <Router>
      {/* AuthProvider wraps the entire application to provide auth context to all components */}
      <AuthProvider>
        {/* Navbar and SideBars are always rendered, their content/visibility depends on state/settings */}
        <Navbar toggleLeftSidebar={toggleLeftSidebar} toggleRightSidebar={toggleRightSidebar} />
        <SideBar isOpen={isLeftSidebarOpen} onClose={closeAllSidebars} side="left" />
        <SideBar isOpen={isRightSidebarOpen} onClose={closeAllSidebars} side="right" />

        <div className="app-content"> {/* Main content area where routes are rendered */}
          <Routes>

            {/* Public only routes (e.g., login, signup). Redirects if already authenticated. */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>

            {/* Protected Routes (accessible only if isAuthenticated) */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ImageGrid />} /> {/* Main image gallery */}
              {/* Other general protected routes can go here */}
            </Route>
            {/* Catch-all route for any undefined paths. */}
            {/* If authenticated, navigates to home (/). If not, navigates to login (/login). */}
            <Route path="*" element={<HomeOrLoginRedirect />} />
          </Routes>
        </div>
      </AuthProvider>
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
