// frontend/src/components/Navbar.jsx

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import NavSearchBar from './NavSearchBar'; // Assuming NavSearchBar is in components

/**
 * Navigation bar component for the application.
 * Displays navigation links, search bar, and authentication status.
 *
 * @param {object} props - Component props.
 * @param {function} props.toggleLeftSidebar - Callback to toggle the left sidebar.
 * @param {function} props.toggleRightSidebar - Callback to toggle the right sidebar.
 */
function Navbar({
  toggleLeftSidebar,
  toggleRightSidebar,
  initialSearchTerm,
  initialSortBy,
  initialSortOrder,
  onSearchAndSortChange
}) {
  const { isAuthenticated, user, logout, isAdmin, settings } = useAuth();
  const navigate = useNavigate();

  // Determine sidebar toggle visibility based on settings from AuthContext
  // Default to false if settings are not yet loaded to prevent errors
  const showLeftToggle = settings?.sidebar_left_enabled === true;
  const showRightToggle = settings?.sidebar_right_enabled === true;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left Sidebar Toggle Button */}
        {showLeftToggle && (
          <button onClick={toggleLeftSidebar} className="navbar-toggle-button navbar-toggle-button--left" aria-label="Open left menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        )}

        {/* Search Bar (visible when authenticated) */}

        {isAuthenticated && (
          <NavSearchBar
            initialSearchTerm={initialSearchTerm}
            initialSortBy={initialSortBy}
            initialSortOrder={initialSortOrder}
            onSearchAndSortChange={onSearchAndSortChange}
          />
        )}

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
}

export default Navbar;
