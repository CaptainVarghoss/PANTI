import { useEffect, useCallback } from 'react';

/**
 * A custom hook to manage all global keyboard shortcuts in one place.
 * It takes the current application state and relevant action dispatchers
 * to decide which shortcuts are active.
 *
 * @param {object} params - The state and handlers needed for the shortcuts.
 */
export const useGlobalHotkeys = ({
  // Modal states and handlers
  isModalOpen,
  modalType,
  closeModal,
  canGoPrev,
  canGoNext,
  handlePrev,
  handleNext,
  toggleFullScreen,

  // Image Grid states and handlers
  isGridActive,
  focusedImage,
  handleGridNavigation,
  handleImageOpen,

  // Dialog states and handlers
  isConfirmDialogOpen,
  closeConfirmDialog,

  // Context Menu states and handlers
  isContextMenuOpen,
  closeContextMenu,
}) => {
  const handleKeyDown = useCallback((event) => {
    // Do not interfere with text input fields.
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    // The most specific/top-level components get priority.

    // 1. Confirmation Dialog
    if (isConfirmDialogOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmDialog();
      }
      return; // Stop further processing
    }

    // 2. Context Menu
    if (isContextMenuOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeContextMenu();
      }
      return; // Stop further processing
    }

    // 3. Main Modal
    if (isModalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      } else if (modalType === 'image') {
        if (event.key === 'ArrowRight' && canGoNext) handleNext();
        else if (event.key === 'ArrowLeft' && canGoPrev) handlePrev();
        else if (event.key === 'f') toggleFullScreen();
        else if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          closeModal();
        }
      }
      return; // Stop further processing
    }

    // 4. Image Grid Navigation (only if no modal is open)
    if (isGridActive) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        handleGridNavigation(event.key);
      } else if ((event.key === ' ' || event.key === 'Enter') && focusedImage) {
        event.preventDefault();
        handleImageOpen(event, focusedImage);
      } else if (event.key === 'f') toggleFullScreen();
    }

  }, [
    isModalOpen, modalType, closeModal, canGoPrev, canGoNext, handlePrev, handleNext, toggleFullScreen,
    isGridActive, focusedImage, handleGridNavigation, handleImageOpen,
    isConfirmDialogOpen, closeConfirmDialog, isContextMenuOpen, closeContextMenu
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};