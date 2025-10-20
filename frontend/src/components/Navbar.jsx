// frontend/src/components/Navbar.jsx

import React, {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import NavSearchBar from './NavSearchBar';
import NavMenuBar from './NavMenu';
import { BiSolidChevronsDown } from "react-icons/bi";
import { BiSolidChevronsUp } from "react-icons/bi";
import { MdOutlineSettings } from "react-icons/md";
import Icon from './Icon';

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
  setFilters = () => {}
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
            {navOpen ? <BiSolidChevronsUp size={25} /> : <BiSolidChevronsDown size={25} />}
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
                >
                  <span dangerouslySetInnerHTML={{ __html: filter.icon }} />
                </button>
              )
            ))}
          </>
        )}
        {/* Right Nav Menu Toggle Button */}
        {settings.sidebar_right_enabled && (
          <button onClick={toggleNavOpen} className="navbar-open-button">
            {navOpen ? <BiSolidChevronsUp size={25} /> : <BiSolidChevronsDown size={25} />}
          </button>
        )}
      </div>
      <div className={`nav-menu-bar ${navOpen ? 'open' : 'closed' }`}>
        {/* Left Sidebar Toggle Button */}
        {settings.sidebar_left_enabled && (
          <button onClick={toggleLeftSidebar} className="navbar-toggle-button navbar-toggle-button--left" aria-label="Open left menu">
            <MdOutlineSettings size={25} />
          </button>
        )}
        {isAuthenticated && (
          <NavMenuBar 
            navOpen={navOpen}
            setNavOpen={setNavOpen}
          />
        )}
        {/* Right Sidebar Toggle Button */}
        {settings.sidebar_right_enabled && (
          <button onClick={toggleRightSidebar} className="navbar-toggle-button navbar-toggle-button--right" aria-label="Open right menu">
            <MdOutlineSettings size={25} />
          </button>
        )}      
      </div>
    </nav>
  );
}

export default Navbar;