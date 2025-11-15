import React, {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import NavbarButtons from './NavbarButtons';
import NavbarMenuButtons from './NavbarMenuButtons';
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
  isSelectMode,
  setIsSelectMode,
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
      <div className="navbar-main">
        {/* Left Navbar Buttons */}
        {settings.sidebar_left_enabled && (
          <div className="navbar-buttons side-left">
            <NavbarButtons
              navOpen={navOpen}
              setNavOpen={setNavOpen}
              toggleNavOpen={toggleNavOpen}
              handleFilterToggle={handleFilterToggle}
              filters={filters}
            />
          </div>
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

        {/* Right Navbar Buttons */}
        {settings.sidebar_right_enabled && (
          <div className="navbar-buttons side-right">
            <NavbarButtons
              navOpen={navOpen}
              setNavOpen={setNavOpen}
              toggleNavOpen={toggleNavOpen}
              handleFilterToggle={handleFilterToggle}
              filters={filters}
            />
          </div>
        )}
      </div>
      <div className={`navbar-menu ${navOpen ? 'open' : 'closed' }`}>
        {/* Left Sidebar Toggle Button */}
        {settings.sidebar_left_enabled && (
          <NavbarMenuButtons
            side="left"
            toggleLeftSidebar={toggleLeftSidebar}
            toggleRightSidebar={toggleRightSidebar}
          />
        )}
        {isAuthenticated && (
          <NavMenuBar 
            navOpen={navOpen}
            setNavOpen={setNavOpen}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
          />
        )}
        {/* Right Sidebar Toggle Button */}
        {settings.sidebar_right_enabled && (
          <NavbarMenuButtons
            side="right"
            toggleLeftSidebar={toggleLeftSidebar}
            toggleRightSidebar={toggleRightSidebar}
          />
        )}
      </div>
    </nav>
  );
}

export default Navbar;