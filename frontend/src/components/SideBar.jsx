import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // To check user roles for admin links
import ImagePathsManagement from './ImagePathsManagement';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm';
import GlobalSettingsForm from './GlobalSettingsForm';
import GroupDisplay from './GroupDisplay';
//import TagGroup from './TagGroup';
import TagManager from './TagManager';
import FilterManager from './FilterManager';
import FilterGroup from './FilterGroup';

/**
 * A reusable Sidebar component that slides in and out using standard CSS.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the sidebar.
 * @param {function} props.onClose - Callback function to close the sidebar.
 */
function Sidebar({
  isOpen,
  onClose,
  side,
  subPanel,
  setSubPanel,
  searchTerm,
  setSearchTerm,
  activeFilters,
  setActiveFilters
}) {
  const { isAdmin, isAuthenticated, logout } = useAuth(); // Get admin status from AuthContext
  const sidebarClasses = `sidebar sidebar--${side} ${isOpen ? `sidebar--${side}--open` : ''}`;
  const overlayClasses = `sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`;

  const [allAvailableTags, setAllAvailableTags] = useState([]);
  const [allAvailableFilters, setAllAvailableFilters] = useState([]);

  const handleShowSettings = (e) => {
    e.preventDefault(); // Prevent default link behavior
    setSubPanel('settings');
  };

  const handleBackToMenu = () => {
    setSubPanel('menu');
  };

  const handleShowFolders = (e) => { // New handler for folders
    e.preventDefault();
    setSubPanel('folders');
  };

  const handleLogout = () => {
    onClose();
    logout(); // Call the logout function from AuthContext
    navigate('/login'); // Redirect to login page after logout
  };

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setSubPanel('menu'), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay: clickable to close sidebar, visible when open */}
      <div className={overlayClasses} onClick={onClose} aria-hidden="true"></div>

      {/* Sidebar content */}
      <div className={sidebarClasses}>
        <div className={`sidebar-header sidebar-header--${side}`}>
          <button onClick={onClose} className="navbar-toggle-button" aria-label="Close menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>
        <div className="sidebar-panel-wrapper">

          <div className={`sidebar-panel
            ${subPanel === 'menu' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'menu' ? 'panel-active' : 'panel-inactive'}`}
          >
            <nav className="sidebar-nav">
              <div className="sidebar-filters">
                <FilterGroup
                  activeFilters={activeFilters}
                  setActiveFilters={setActiveFilters}
                  allAvailableFilters={allAvailableFilters}
                  setAllAvailableFilters={setAllAvailableFilters}
                  setSubPanel={setSubPanel}
                />
              </div>

              <div className="refiner-container">

                <div className="sidebar-tags">
                  <GroupDisplay
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      onClose={onClose}
                      title="Tags"
                      apiEndpoint="/api/tags/"
                      editPanelName="tagEdit"
                      setSubPanel={setSubPanel}
                      itemType="tag" // For specific class names like sidebar-tag-section
                      allAvailableTags={allAvailableTags}
                      setAllAvailableTags={setAllAvailableTags}
                  />
                </div>

              </div>

              <a href="#" onClick={handleShowFolders} className="sidebar-link">Manage Folders</a>

              <a href="#" onClick={handleShowSettings} className="sidebar-link">Settings</a>

              <button onClick={handleLogout} className="">Logout</button>
            </nav>
          </div>

          <div className={`sidebar-panel
            ${subPanel === 'filterEdit' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'filterEdit' ? 'panel-active' : 'panel-inactive'}`}
          >
            <button onClick={handleBackToMenu} className="settings-back-button">
              ← Back to Main Menu
            </button>
            <div className="filter-manager">
              <div className="filter-manager-section">
                <FilterManager
                  activeFilters={activeFilters}
                  setActiveFilters={setActiveFilters}
                  allAvailableFilters={allAvailableFilters}
                  setAllAvailableFilters={setAllAvailableFilters}
                />
              </div>
            </div>
          </div>


          <div className={`sidebar-panel
            ${subPanel === 'tagEdit' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'tagEdit' ? 'panel-active' : 'panel-inactive'}`}
          >
            <button onClick={handleBackToMenu} className="settings-back-button">
              ← Back to Main Menu
            </button>
            <div className="tag-manager">
              <div className="tag-manager-section">
                <TagManager allAvailableTags={allAvailableTags} setAllAvailableTags={setAllAvailableTags} />
              </div>
            </div>
          </div>

          <div className={`sidebar-panel
            ${subPanel === 'settings' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'settings' ? 'panel-active' : 'panel-inactive'}`}
          >
            <button onClick={handleBackToMenu} className="settings-back-button">
              ← Back to Main Menu
            </button>
            <nav className="settings-sub-nav">
              <a href="#" onClick={(e) => { e.preventDefault(); setSubPanel('device'); }} className="settings-link">
                Device Specific Settings
              </a>
              {isAdmin && (
                <a href="#" onClick={(e) => { e.preventDefault(); setSubPanel('global'); }} className="settings-link">
                  Global Server Settings (Admin)
                </a>
              )}
            </nav>
          </div>

          <div className={`sidebar-panel
                       ${subPanel === 'folders' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
                       ${subPanel === 'folders' ? 'panel-active' : 'panel-inactive'}`}
          >
            <ImagePathsManagement onBack={handleBackToMenu} onClose={onClose} side={side} />
          </div>

          <div className={`sidebar-panel
            ${subPanel === 'device' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'device' ? 'panel-active' : 'panel-inactive'}`}
          >
            <DeviceSpecificSettingsForm onBack={handleShowSettings} onClose={onClose} side={side} />
          </div>

          <div className={`sidebar-panel
            ${subPanel === 'global' ? (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right') : (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right')}
            ${subPanel === 'global' ? 'panel-active' : 'panel-inactive'}`}
          >
            <GlobalSettingsForm onBack={handleShowSettings} onClose={onClose} side={side} />
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;