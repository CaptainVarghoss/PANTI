import React, {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import NavbarButtons from './NavbarButtons';
import NavbarMenuButtons from './NavbarMenuButtons';
import NavSearchBar from './NavSearchBar';
import NavMenuBar from './NavMenu';
import SelectionToolbar from './SelectionToolbar';

/**
 * Navigation bar component for the application.
 * Displays navigation links, search bar, and authentication status.
 *
 * @param {object} props - Component props.
 */
function Navbar({
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
  isConnected,
  currentView,
  setCurrentView,
  selectedImages,
  setSelectedImages,
  trashCount,
  setTrashCount,
  images,
  onTrashBulkAction,
  handleMoveSelected,
  onSettingsClick
}) {
  const { token, isAuthenticated, user, logout, isAdmin, settings } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const toggleNavOpen = () => {
    setNavOpen(!navOpen);
  };

  const handleFilterToggle = (filterId) => {
    setFilters(prevFilters => {
      return prevFilters.map(f => {
        if (f.id !== filterId) return f;

        const isThreeStage = f.third_stage !== 'disabled';
        let nextIndex = f.activeStageIndex;

        if (isThreeStage) {
          // Cycle through 0, 1, 2
          nextIndex = (f.activeStageIndex + 1) % 3;
        } else {
          // Toggle between 0 and 1
          nextIndex = f.activeStageIndex === 0 ? 1 : 0;
        }

        // If the filter was off (index -1), turn it on to the first stage (index 0)
        return { ...f, activeStageIndex: f.activeStageIndex === -1 ? 0 : nextIndex };
      });
    });
  };

  // --- Selection Toolbar Handlers ---
  const handleSelectAll = () => {
    const allImageIds = new Set(images.map(img => img.id));
    setSelectedImages(allImageIds);
  };

  const handleClearSelection = () => {
    setSelectedImages(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedImages.size > 0) {
      const imageIds = Array.from(selectedImages);
      try {
        const response = await fetch('/api/images/delete-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(imageIds),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to move images to trash.');
        }

        // UI updates via websocket, just clear selection
        setSelectedImages(new Set());
      } catch (error) {
        console.error("Error during bulk delete:", error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  return (
    <nav>
      <div className={`navbar-main ${isSelectMode ? 'select-mode' : ''}`}>
        {/* Left Navbar Buttons */}
        {settings.left_enabled && (
          <ul className="side-left">
            <NavbarButtons
              navOpen={navOpen}
              setNavOpen={setNavOpen}
              toggleNavOpen={toggleNavOpen}
              handleFilterToggle={handleFilterToggle}
              filters={filters}
            />
          </ul>
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
        {settings.right_enabled && (
          <ul className="side-right">
            <NavbarButtons
              navOpen={navOpen}
              setNavOpen={setNavOpen}
              toggleNavOpen={toggleNavOpen}
              handleFilterToggle={handleFilterToggle}
              filters={filters}
            />
          </ul>
        )}
      </div>
      <div className={`navbar-menu ${navOpen ? 'open' : 'closed' } ${isSelectMode ? 'select-mode' : ''}`}>
        {/* Left Settings Button */}
        {settings.left_enabled && (
          <NavbarMenuButtons
            side="left"
            trashCount={trashCount}
            setCurrentView={setCurrentView}
            onSettingsClick={onSettingsClick}
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
            currentView={currentView}
            setCurrentView={setCurrentView}
            trashCount={trashCount}
            setTrashCount={setTrashCount}
          />
        )}
        {/* Right Settings Button */}
        {settings.right_enabled && (
          <NavbarMenuButtons
            side="right"
            trashCount={trashCount}
            setCurrentView={setCurrentView}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
            onSettingsClick={onSettingsClick}
          />
        )}
      </div>
      {isSelectMode && (
        <SelectionToolbar
          selectedCount={selectedImages.size}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onExit={() => setIsSelectMode(false)}
          // Conditionally render actions based on the current view
          customActions={
            currentView === 'trash'
              ? [
                  { label: 'Restore Selected', handler: () => onTrashBulkAction('restore'), danger: false },
                  { label: 'Delete Selected Permanently', handler: () => onTrashBulkAction('delete_permanent'), danger: true },
                ]
              : [
                  { label: 'Move', handler: handleMoveSelected, danger: false },
                  { label: 'Delete', handler: handleDeleteSelected, danger: true },
                ]
          }
        />
      )}
    </nav>
  );
}

export default Navbar;