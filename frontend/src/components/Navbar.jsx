// frontend/src/components/Navbar.jsx

import React, {useState} from 'react';
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
  searchTerm,
  setSearchTerm,
  onSearchAndSortChange,
  activeFilters,
  setActiveFilters
}) {
  const { isAuthenticated, user, logout, isAdmin, settings } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left Sidebar Toggle Button */}
        {settings.sidebar_left_enabled && (
          <button onClick={toggleLeftSidebar} className="navbar-toggle-button navbar-toggle-button--left" aria-label="Open left menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        )}

        {/* Search Bar (visible when authenticated) */}

        {isAuthenticated && (
          <NavSearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSearchAndSortChange={onSearchAndSortChange}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
          />
        )}

        {/* Right Sidebar Toggle Button */}
        {settings.sidebar_right_enabled && (
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
