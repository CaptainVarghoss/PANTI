import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid";
import Login from './pages/Login';
import Signup from './pages/Signup';
import NavSearchBar from './components/NavSearchBar';
import SideBar from './components/SideBar';
import './App.css';


const PublicOnlyRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If already authenticated, redirect to home page
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login
  // If authenticated but not admin, show forbidden or redirect to home
  return isAuthenticated && isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

const Navbar = ({ toggleLeftSidebar, toggleRightSidebar }) => {
  const { isAuthenticated, user, logout, isAdmin, settings } = useAuth();

  const sidebarSetting = settings.sidebar ? settings.sidebar.toLowerCase() : 'left'; // Default to 'left'
  const showLeftToggle = sidebarSetting === 'left' || sidebarSetting === 'both';
  const showRightToggle = sidebarSetting === 'right' || sidebarSetting === 'both';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {showLeftToggle && (
          <button onClick={toggleLeftSidebar} className="navbar-toggle-button navbar-toggle-button--left" aria-label="Open left menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        )}

        <div className="navbar-search">
          {isAuthenticated && (
            <NavSearchBar />
          )}
        </div>

        {/* Right Sidebar Toggle Button */}
        {showRightToggle && (
          <button onClick={toggleRightSidebar} className="navbar-toggle-button navbar-toggle-button--right" aria-label="Open right menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        )}
      </div>
    </nav>
  );
};

function App() {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  }

  const toggleLeftSidebar = () => {
    setIsLeftSidebarOpen(!isLeftSidebarOpen);
    if (isRightSidebarOpen) setIsRightSidebarOpen(false);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(!isRightSidebarOpen);
    if (isLeftSidebarOpen) setIsLeftSidebarOpen(false);
  };

  // Function to close both sidebars
  const closeAllSidebars = () => {
    setIsLeftSidebarOpen(false);
    setIsRightSidebarOpen(false);
  };

  return (
    <Router>
      <AuthProvider>
        <Navbar toggleLeftSidebar={toggleLeftSidebar} toggleRightSidebar={toggleRightSidebar} />
        {/* Render Left Sidebar */}
        <SideBar isOpen={isLeftSidebarOpen} onClose={closeAllSidebars} side="left" />
        {/* Render Right Sidebar */}
        <SideBar isOpen={isRightSidebarOpen} onClose={closeAllSidebars} side="right" />
        <div className="main-container">
          <Routes>

            {/* Public only routes */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>

            {/* Protected Routes (accessible only if isAuthenticated) */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ImageGrid />} />
            </Route>

            {/* Catch-all for undefined routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;