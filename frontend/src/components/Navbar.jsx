// frontend/src/components/Navbar.jsx

import React, {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import NavSearchBar from './NavSearchBar';
import NavMenuBar from './NavMenu';

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
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,  
  filters = [],
  setFilters = () => {},
  isConnected
}) {
  const { isAuthenticated, user, logout, isAdmin, settings } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const toggleNavOpen = () => {
    setNavOpen(!navOpen);
  };

  const handleFilterToggle = (filterId) => {
    setFilters(prevFilters =>
      prevFilters.map(f =>
        f.id === filterId ? { ...f, isSelected: !f.isSelected } : f
      )
    );
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left Nav Menu Toggle Button */}
        {settings.sidebar_left_enabled && (
          <button onClick={toggleNavOpen} className="navbar-open-button">
            {navOpen ? <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z"/></svg>}
          </button>
        )}
        {/* Left Filter Buttons */}
        {settings.sidebar_left_enabled && (
          <div></div>
        )}

        {/* Search Bar (visible when authenticated) */}
        {isAuthenticated && (
          <NavSearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSearchAndSortChange={onSearchAndSortChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
            filters={filters}
            setFilters={setFilters}
          />
        )}

        {/* Right Filter Buttons */}
        {settings.sidebar_right_enabled && (
          <>
            {filters.map(filter => (
              filter.header_display === true && (
                <button 
                  key={filter.id} 
                  className={`filter-menu-button ${filter.isSelected ? 'active' : ''}`}
                  onClick={() => handleFilterToggle(filter.id)}
                  dangerouslySetInnerHTML={{ __html: filter.icon }}
                  >
                </button>
              )
            ))}
          </>
        )}
        {/* Right Nav Menu Toggle Button */}
        {settings.sidebar_right_enabled && (
          <button onClick={toggleNavOpen} className="navbar-open-button">
            {navOpen ? <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z"/></svg>}
          </button>
        )}
      </div>
      <div className={`nav-menu-bar ${navOpen ? 'open' : 'closed' }`}>
        {/* Left Sidebar Toggle Button */}
        {settings.sidebar_left_enabled && (
          <button onClick={toggleLeftSidebar} className="navbar-toggle-button navbar-toggle-button--left" aria-label="Open left menu">
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
          </button>
        )}
        {isAuthenticated && (
          <NavMenuBar 
            navOpen={navOpen}
            setNavOpen={setNavOpen}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
          />
        )}
        {/* Right Sidebar Toggle Button */}
        {settings.sidebar_right_enabled && (
          <button onClick={toggleRightSidebar} className="navbar-toggle-button navbar-toggle-button--right" aria-label="Open right menu">
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
          </button>
        )}      
      </div>
    </nav>
  );
}

export default Navbar;