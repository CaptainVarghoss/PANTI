import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom'; // Keep for potential future routing needs
import { useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid"; // Assuming ImageGrid is now a page component
import { AnimatePresence } from 'framer-motion';
import FolderTree from './components/FolderTree'; // NEW IMPORT
import Modal from './components/Modal';
import MoveFilesForm from './components/MoveFilesForm'; // Import the new move form
import TrashView from './components/TrashView';
import UnauthenticatedApp from './components/UnauthenticatedApp'; // Import the new component
import Navbar from './components/Navbar'; // Import Navbar from its own file
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys'; // Import the new hook
import { useWebSocket } from './hooks/useWebSocket'; // Import the custom hook

import './App.css';

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
  const { isAuthenticated, loading, token, isAdmin } = useAuth();
  // States for search and sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [webSocketMessage, setWebSocketMessage] = useState(null);
  const [currentView, setCurrentView] = useState('grid');
  const [images, setImages] = useState([]);
  const [trashImages, setTrashImages] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [folderViewSearchTerm, setFolderViewSearchTerm] = useState(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState(null); // State for the selected folder path

  // State for keyboard navigation in ImageGrid
  const [focusedImageId, setFocusedImageId] = useState(null);
  const getFocusedImage = useCallback(() => images.find(img => img.id === focusedImageId), [images, focusedImageId]);
  
  // --- Centralized Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalProps, setModalProps] = useState({});
  const [navigationDirection, setNavigationDirection] = useState(0);
  const [isClosingModal, setIsClosingModal] = useState(false);

  // --- Fullscreen State ---
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullScreen = useCallback(() => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
              alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
          });
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
  }, []);

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const openModal = (type, newProps) => {
    setModalType(type);

    if (type === 'image') {
      const onNavigate = (nextImage, direction) => {
          setNavigationDirection(direction);
          setModalProps(currentProps => ({ ...currentProps, currentImage: nextImage }));
          if (nextImage) setFocusedImageId(nextImage.id); // Sync grid focus with modal
      };
      // When opening, set the full props. The `images` prop will be overridden by the one on the Modal component itself.
      setModalProps({ ...newProps, onNavigate, images: newProps.images });
    } else if (type === 'moveFiles') {
      setNavigationDirection(0); // Ensure no slide animation for other modals
      setModalProps({
        ...newProps,
        ContentComponent: MoveFilesForm,
      });
    } else {
      setModalProps(newProps);
    }

    setIsModalOpen(true);
  };

  // This effect ensures that when the main `images` state updates (e.g., from infinite scroll),
  // the modal gets the new list, allowing navigation to continue.
  useEffect(() => {
    if (isModalOpen && modalType === 'image') {
      setModalProps(currentProps => ({
        ...currentProps,
        images: images, // Update the images in the modal props
      }));
    }
  }, [images, isModalOpen, modalType]);

  // This effect triggers the actual closing of the modal *after* the originBounds have been updated.
  useEffect(() => {
    if (isClosingModal) {
      setIsModalOpen(false);
      setIsClosingModal(false); // Reset the trigger
    }
  }, [isClosingModal]);

  const closeModal = () => {
    // For image modals, we want to update the origin bounds for the exit animation
    // to target the *current* image's thumbnail, not the one that opened the modal.
    if (modalType === 'image' && modalProps.currentImage) {
      const imageId = modalProps.currentImage.id;
      const cardElement = document.querySelector(`[data-image-id="${imageId}"]`);

      if (cardElement) {
        const newBounds = cardElement.getBoundingClientRect();
        setModalProps(currentProps => ({
          ...currentProps,
          originBounds: newBounds,
        }));
        setIsClosingModal(true); // Trigger the close effect
      } else {
        setIsModalOpen(false); // Fallback if the element isn't found
      }
    } else {
      setIsModalOpen(false); // For non-image modals, close immediately.
    }
  };

  const refetchFilters = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
        const response = await fetch('/api/filters/', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedFilters = await response.json();
        // If header_display > 0, the filter is enabled and should default to the main stage (index 0).
        // If header_display is 0, the filter is disabled (index -2).
        const initializedFilters = fetchedFilters.map(f => ({ ...f, activeStageIndex: f.header_display > 0 ? 0 : -2 }));
        setFilters(initializedFilters); // Update the global state
        return initializedFilters; // Return the new state
    } catch (error) {
        console.error(`Error refetching filters:`, error);
        return null; // Return null on error
    }
  }, [isAuthenticated, token]);

  // Pass the standard setFilters function for direct state updates (e.g., from Navbar)
  const handleSetFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleSettingsClick = () => {
    openModal('settings', {
      // Props that don't change, like handlers, can stay here.
    });
  };

  const handleSetCurrentView = (view) => {
    // When the view changes, exit select mode and clear the selection
    if (currentView !== view) {
        setIsSelectMode(false);
        setSelectedImages(new Set());
        // When switching to folder view, clear the images and reset the folder search term
        if (view === 'folders') {
          setImages([]);
          setFolderViewSearchTerm(null);
        }
    }
    setCurrentView(view);
  };

  // Handler for when a folder is selected in the folder view
  const handleFolderSelect = (folderPath) => {
    setSelectedFolderPath(folderPath); // Keep track of the selected path
    if (folderPath) {
      setFolderViewSearchTerm(`Folder:"${folderPath}"`);
    } else {
      setFolderViewSearchTerm(null); // Set to null to show no images
    }
  };

  // Callback to handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    console.log("File change detected:", message);
    setWebSocketMessage(message);
  }, []);

  // --- Grid Navigation and Actions ---
  const handleGridNavigation = useCallback((key) => {
    if (!images || images.length === 0) return;

    const gridEl = document.querySelector('.image-grid');
    if (!gridEl) return;

    const gridStyle = window.getComputedStyle(gridEl);
    const gridTemplateColumns = gridStyle.getPropertyValue('grid-template-columns');
    const columns = gridTemplateColumns.split(' ').length;

    let currentIndex = -1;
    if (focusedImageId !== null) {
      currentIndex = images.findIndex(img => img.id === focusedImageId);
    } else {
      setFocusedImageId(images[0].id);
      return;
    }

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    switch (key) {
      case 'ArrowLeft': nextIndex = Math.max(0, currentIndex - 1); break;
      case 'ArrowRight': nextIndex = Math.min(images.length - 1, currentIndex + 1); break;
      case 'ArrowUp': nextIndex = Math.max(0, currentIndex - columns); break;
      case 'ArrowDown': nextIndex = Math.min(images.length - 1, currentIndex + columns); break;
      default: break;
    }

    if (nextIndex !== currentIndex) {
      const nextImage = images[nextIndex];
      if (nextImage) {
        setFocusedImageId(nextImage.id);
        const cardElement = document.querySelector(`[data-image-id="${nextImage.id}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [images, focusedImageId]);

  // --- Hotkey Hook Integration ---
  useGlobalHotkeys({
    // Modal states
    isModalOpen,
    modalType,
    closeModal,
    canGoPrev: modalProps.onNavigate && modalProps.images?.findIndex(img => img.id === modalProps.currentImage?.id) > 0,
    canGoNext: modalProps.onNavigate && modalProps.images?.findIndex(img => img.id === modalProps.currentImage?.id) < (modalProps.images?.length ?? 0) - 1,
    handlePrev: () => modalProps.onNavigate && modalProps.onNavigate(modalProps.images[modalProps.images.findIndex(img => img.id === modalProps.currentImage.id) - 1], -1),
    handleNext: () => modalProps.onNavigate && modalProps.onNavigate(modalProps.images[modalProps.images.findIndex(img => img.id === modalProps.currentImage.id) + 1], 1),
    toggleFullScreen: toggleFullScreen,

    // Grid states
    isGridActive: !isModalOpen,
    focusedImage: getFocusedImage(),
    handleGridNavigation,
    handleImageOpen: (e, image) => {
      // This reuses the logic from ImageGrid's handleImageClick
      const imageCard = document.querySelector(`[data-image-id="${image.id}"]`);
      if (imageCard) imageCard.click();
    },
    // We can add dialog/context menu states here if they become globally managed
  });


  // WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const websocketUrl = `${protocol}//${window.location.hostname}:8000/ws/image-updates`;
  const { isConnected } = useWebSocket(isAuthenticated ? websocketUrl : null, token, isAdmin, handleWebSocketMessage);

  
  const ConnectionStatus = () => (
    <div id="connection" style={{borderColor: isConnected ? 'var(--accent-green)' : 'var(--accent-red)', backgroundColor: isConnected ? 'var(--accent-green)' : 'var(--accent-red)'}}></div>
  );
  
  // States for select mode
  const [isSelectMode, setIsSelectMode] = useState(false);


  // Callback to update search and sort states from NavSearchBar
  const handleSearchAndSortChange = useCallback((newSearchTerm, newSortBy, newSortOrder) => {
      setSearchTerm(newSearchTerm);
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
  }, []);

  // Filter states
  const [filters, setFilters] = useState([]);

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
    // Use the useCallback version of refetchFilters for the initial fetch.
    refetchFilters();
  }, [isAuthenticated, refetchFilters]);

  // Effect to fetch trash count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTrashCount = async () => {
      try {
        const response = await fetch('/api/trash/info', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch trash count');
        const data = await response.json();
        setTrashCount(data.item_count);
      } catch (error) {
        console.error("Error fetching trash count:", error);
      }
    };

    fetchTrashCount();
  }, [isAuthenticated, token, webSocketMessage, debouncedSearchTerm]); // Also refetch on search change

  const handleMoveSelected = () => {
    if (selectedImages.size > 0) {
      openModal('moveFiles', {
        filesToMove: Array.from(selectedImages),
        onMoveSuccess: () => {
          setIsSelectMode(false); // Turn off select mode
          closeModal();
          setSelectedImages(new Set()); // Clear selection after move
        },
      });
    }
  };

  const handleMoveSingleImage = (imageId) => {
    if (!imageId) return;
    openModal('moveFiles', {
      filesToMove: [imageId],
      onMoveSuccess: () => {
        closeModal();
        // No selection state to clear as this is from a single-item context menu
      },
    });
  };

  const handleTrashBulkAction = async (action) => {
    const imageIds = Array.from(selectedImages);
    if (imageIds.length === 0) return;

    let endpoint = '';
    let confirmMessage = '';

    if (action === 'restore') {
        endpoint = '/api/trash/restore';
        confirmMessage = `Are you sure you want to restore ${imageIds.length} image(s)?`;
    } else if (action === 'delete_permanent') {
        endpoint = '/api/trash/delete-permanent';
        confirmMessage = `Are you sure you want to PERMANENTLY delete ${imageIds.length} selected image(s)? This action cannot be undone.`;
    }

    if (!window.confirm(confirmMessage)) return;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(imageIds),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to ${action} images.`);
        }

        // The view will update via websocket, just clear selection.
        setSelectedImages(new Set());
    } catch (error) {
        console.error(`Error during bulk ${action}:`, error);
        alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-full-page">
        Loading application...
      </div>
    );
  }

  return (
    <Router>
      <div className="main-content">
        {isAuthenticated ? (
          <>
            <header>
              <Navbar
              searchTerm={searchTerm}
              onSearchAndSortChange={handleSearchAndSortChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              setSortBy={setSortBy}
              setSortOrder={setSortOrder}
              setSearchTerm={setSearchTerm}
              filters={filters}
              setFilters={setFilters}
              isConnected={isConnected}
              isSelectMode={isSelectMode}
              setIsSelectMode={setIsSelectMode}
              currentView={currentView}
              setCurrentView={handleSetCurrentView}
              selectedImages={selectedImages}
              setSelectedImages={setSelectedImages}
              trashCount={trashCount}
              setTrashCount={setTrashCount}
              images={currentView === 'trash' ? trashImages : images}
              onTrashBulkAction={handleTrashBulkAction}
              onSettingsClick={handleSettingsClick}
              handleMoveSelected={handleMoveSelected}
            />
            <ConnectionStatus />
            </header>
            <main>
              {currentView === 'grid' && (
                <ImageGrid
                  images={images}
                  setImages={setImages}
                  searchTerm={searchTerm}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  setSearchTerm={setSearchTerm}
                  webSocketMessage={webSocketMessage}
                  setWebSocketMessage={setWebSocketMessage}
                  filters={filters}
                  isSelectMode={isSelectMode}
                  setIsSelectMode={setIsSelectMode}
                  selectedImages={selectedImages}
                  setSelectedImages={setSelectedImages}
                  handleMoveSelected={handleMoveSelected}
                  handleMoveSingleImage={handleMoveSingleImage}
                  focusedImageId={focusedImageId}
                  setFocusedImageId={setFocusedImageId}
                  openModal={openModal}
                />
              )}
              {currentView === 'trash' && (
                <TrashView
                  images={trashImages}
                  setImages={setTrashImages}
                  webSocketMessage={webSocketMessage}
                  setWebSocketMessage={setWebSocketMessage}
                  setTrashCount={setTrashCount}
                  setCurrentView={handleSetCurrentView}
                  isSelectMode={isSelectMode}
                  setIsSelectMode={setIsSelectMode}
                  selectedImages={selectedImages}
                  setSelectedImages={setSelectedImages}
                />
              )}
              {currentView === 'folders' && (
                <div className="folder-layout-container">
                  <div className="folder-tree-panel">
                    <FolderTree
                      onSelectFolder={handleFolderSelect}
                      webSocketMessage={webSocketMessage}
                      selectedFolderPath={selectedFolderPath} // Pass the selected path
                      setWebSocketMessage={setWebSocketMessage}
                    />
                  </div>
                  <div className="image-grid-panel">
                    <ImageGrid
                      images={images}
                      setImages={setImages}
                      searchTerm={folderViewSearchTerm}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      webSocketMessage={webSocketMessage}
                      setWebSocketMessage={setWebSocketMessage}
                      filters={filters}
                      isSelectMode={isSelectMode}
                      setIsSelectMode={setIsSelectMode}
                      selectedImages={selectedImages}
                      setSelectedImages={setSelectedImages}
                      handleMoveSelected={handleMoveSelected}
                      handleMoveSingleImage={handleMoveSingleImage}
                      focusedImageId={focusedImageId}
                      setFocusedImageId={setFocusedImageId}
                      openModal={openModal}
                    />
                  </div>
                </div>
              )}
            </main>
            <AnimatePresence>
              {isModalOpen && (
                <Modal
                  isOpen={isModalOpen}
                  onClose={closeModal}
                  modalType={modalType}
                  modalProps={modalProps}
                  images={images} // Pass the live images array to the modal
                  filters={filters}
                  isFullscreen={isFullscreen}
                  navigationDirection={navigationDirection}
                  toggleFullScreen={toggleFullScreen}
                  refetchFilters={refetchFilters}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <main>
            <UnauthenticatedApp />
          </main>
        )}
      </div>
    </Router>
  );
}

export default App;