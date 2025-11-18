// frontend/src/components/ImageModal.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext'; // fetchSettings to get updated permissions if needed
import TagCluster from './TagCluster';

/**
 * Fullscreen modal to display a large image, its metadata, and allow tag management.
 * Includes navigation for next/previous images within the provided image list.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {function} props.onClose - Callback function to close the modal.
 * @param {object} props.currentImage - The image object currently displayed in the modal.
 * @param {Array<object>} props.images - The full list of images from ImageGrid, for navigation.
 * @param {function} props.onNavigate - Callback to update the currently displayed image in ImageGrid.
 */
function ImageModal({ isOpen, onClose, currentImage, images, onNavigate, searchTerm, setSearchTerm }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [blobImageUrl, setBlobImageUrl] = useState(null);
    const [isFetchingOriginal, setIsFetchingOriginal] = useState(false);
    const [originalImageError, setOriginalImageError] = useState(null);

    const [touchStartX, setTouchStartX] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [imageTranslateX, setImageTranslateX] = useState(0);
    const SWIPE_THRESHOLD = 85; // Minimum horizontal distance for a swipe
    const TAP_THRESHOLD = 10; // Maximum distance for a tap to be considered a click

    // State for tags associated with the current image
    const [imageTagIds, setImageTagIds] = useState(new Set());
    const [isTagsLoading, setIsTagsLoading] = useState(false);
    const [tagsError, setTagsError] = useState(null);

    const modalContentRef = useRef(null); // Renamed from modalRef to avoid confusion with the overlay click

    const usePreview = settings.enable_previews === true;

    useEffect(() => {
        // Cleanup previous Blob URL if it exists
        if (blobImageUrl) {
            URL.revokeObjectURL(blobImageUrl);
            setBlobImageUrl(null); // Reset
        }

        if (!isOpen || !currentImage || usePreview || !isAuthenticated) {
            // If modal is closed, or using previews, or not authenticated, or no current image, do nothing.
            return;
        }

        const fetchOriginalImage = async () => {
            setIsFetchingOriginal(true);
            setOriginalImageError(null);

            const CHECKSUM = currentImage?.content_hash;
            const FILENAME = currentImage?.filename;

            if (!CHECKSUM || !FILENAME) {
                setOriginalImageError("Image data missing (checksum or filename).");
                setIsFetchingOriginal(false);
                return;
            }

            const originalImageApiUrl = `/api/images/original/${CHECKSUM}`;

            try {
                const response = await fetch(originalImageApiUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    // Try to read error message from response body if available
                    let errorMessage = `Failed to load original image: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.detail || errorMessage;
                    } catch (e) {
                        // Ignore if response body is not JSON
                    }
                    throw new Error(errorMessage);
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setBlobImageUrl(url);
            } catch (error) {
                console.error('Error fetching original image:', error);
                setOriginalImageError(error.message || "An unexpected error occurred while fetching the original image.");
                setBlobImageUrl(null); // Ensure no old URL is used
            } finally {
                setIsFetchingOriginal(false);
            }
        };

        fetchOriginalImage();

        // Cleanup function for this effect
        return () => {
            if (blobImageUrl) {
                URL.revokeObjectURL(blobImageUrl);
                setBlobImageUrl(null); // Ensure reset on unmount or dependency change
            }
        };
    }, [isOpen, currentImage, usePreview, isAuthenticated, token]);

    const canModifyTags = isAdmin || (settings?.allow_tag_add === true);

    const fetchImageTags = useCallback(async () => {
        if (!currentImage?.id) {
            setImageTagIds(new Set());
            return;
        }
        setIsTagsLoading(true);
        setTagsError(null);
        try {
            const response = await fetch(`/api/tags/?imageId=${currentImage.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch image tags');
            const tags = await response.json();
            setImageTagIds(new Set(tags.map(t => t.id)));
        } catch (error) {
            setTagsError(error.message);
            console.error("Error fetching image tags:", error);
        } finally {
            setIsTagsLoading(false);
        }
    }, [currentImage, token]);

    useEffect(() => {
        if (isOpen) {
            fetchImageTags();
        }
    }, [isOpen, fetchImageTags]);

    const updateImageTags = async (newTagIdsSet) => {
        if (!currentImage?.id || !canModifyTags) return;

        const payload = {
            tag_ids: Array.from(newTagIdsSet)
        };

        try {
            const response = await fetch(`/api/images/${currentImage.id}/tags`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update tags');
            }
            // Success, UI is already updated optimistically
            console.log("Tags updated successfully");
        } catch (error) {
            console.error('Error saving tags:', error);
            setTagsError(error.message);
            // Revert optimistic update on failure
            fetchImageTags();
        }
    };

    const handleTagToggle = (tag) => {
        if (!canModifyTags) {
            // If user can't edit, clicking a tag should perform a search.
            // The search term should be exact, so we wrap it in quotes.
            if (tag && tag.name) {
                setSearchTerm(`TAG:"${tag.name}"`);
                onClose(); // Close the modal to see the search results
            } else {
                console.error("Cannot perform tag search: tag object is invalid.", tag);
            }
            return;
        }

        // If the user can edit, proceed with toggling the tag for the image.
        const tagId = tag.id;
        const newTagIds = new Set(imageTagIds);
        if (newTagIds.has(tagId)) {
            newTagIds.delete(tagId);
        } else {
            newTagIds.add(tagId);
        }
        setImageTagIds(newTagIds); // Optimistic update
        updateImageTags(newTagIds); // Send update to backend
    };

    // Construct the proper image path is display
    let imageUrlToDisplay;
    const PREVIEWS_DIR = currentImage?.previews_path;
    const previewUrl = `${PREVIEWS_DIR}/${currentImage?.checksum}_preview.webp`;


    if (usePreview) {
        imageUrlToDisplay = previewUrl;
    } else {
        imageUrlToDisplay = blobImageUrl;
    }

    // Navigation logic
    const currentIndex = currentImage ? images.findIndex(img => img.id === currentImage.id) : -1;
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex !== -1 && currentIndex < images.length - 1;

    const navigateImage = useCallback((direction) => {
        if (!images || images.length === 0) return;

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < images.length) {
            onNavigate(images[newIndex]);
        }
    }, [currentIndex, images, onNavigate]);

    const handleNext = () => navigateImage(1);
    const handlePrev = () => navigateImage(-1);

    const handleClick = useCallback((e) => {
        // Prevent event from propagating to the overlay, which would close the modal
        // This handler is specific to closing the modal *when clicking on the image section itself*.
        e.stopPropagation();
        onClose();
    }, [onClose]);

    // --- Swipe Navigation Handlers ---
    const handleTouchStart = useCallback((e) => {
        setTouchStartX(e.touches[0].clientX);
        setTouchStartY(e.touches[0].clientY);
        setImageTranslateX(0);
    }, []);

    const handleTouchMove = useCallback((e) => {

        e.preventDefault();

        const currentTouchX = e.touches[0].clientX;
        const diffX = currentTouchX - touchStartX;

        // Clamp the translation to prevent excessive dragging
        const clampedDiffX = Math.max(-window.innerWidth / 1.5, Math.min(window.innerWidth / 1.5, diffX));
        setImageTranslateX(clampedDiffX);
    }, [touchStartX]);

    const handleTouchEnd = useCallback((e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        setImageTranslateX(0);

        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            // It's a swipe
            if (diffX > SWIPE_THRESHOLD && canGoPrev) {
                handlePrev(); // Swiped right
            } else if (diffX < -SWIPE_THRESHOLD && canGoNext) {
                handleNext(); // Swiped left
            }
        } else if (
            Math.abs(diffX) <= TAP_THRESHOLD && Math.abs(diffY) <= TAP_THRESHOLD) {
            // It's a tap, so close the modal
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
        setTouchStartX(0);
        setTouchStartY(0);
    }, [touchStartX, touchStartY, SWIPE_THRESHOLD, TAP_THRESHOLD, canGoPrev, canGoNext, handlePrev, handleNext, onClose]);

    // Close modal on escape key or outside click
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'ArrowRight' && canGoNext) {
                handleNext();
            } else if (event.key === 'ArrowLeft' && canGoPrev) {
                handlePrev();
            }
        };

        const handleClickOutside = (event) => {
            // Only close if the click is on the overlay itself, not within the modal content
            if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Use 'mouseup' or 'click' on the overlay div directly
            // Adding a listener to document for mousedown can interfere with react-select
            // So we handle the overlay click directly on the modal-overlay div.
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // No need to remove handleClickOutside from document if it's on the overlay div
        };
    }, [isOpen, onClose, handleNext, handlePrev, canGoNext, canGoPrev]);

    if (!isOpen || !currentImage) return null;

    // Helper to render metadata
    const renderMetadata = (meta) => {
        if (!meta) return <p className="modal-text-gray">No metadata available.</p>;

        try {
            const metaObject = typeof meta === 'string' ? JSON.parse(meta) : meta;
            return (
                <ul className="modal-metadata-list">
                    {Object.entries(metaObject).map(([key, value]) => (
                        <li key={key}>
                            <strong className="modal-metadata-key">{key.replace(/_/g, ' ')}:</strong>{' '}
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </li>
                    ))}
                </ul>
            );
        } catch (e) {
            console.error("Error parsing image meta:", e);
            return <p className="modal-error-text">Failed to parse metadata.</p>;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            {/* Close Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="modal-close-button"
                    title="Close"
                >
                    <IoClose size={24} />
                </button>
            {/* Navigation Buttons */}
                    {canGoPrev && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="modal-nav-button modal-nav-button--prev"
                            title="Previous Image"
                        >
                            <IoChevronBack size={32} />
                        </button>
                    )}
                    {canGoNext && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="modal-nav-button modal-nav-button--next"
                            title="Next Image"
                        >
                            <IoChevronForward size={32} />
                        </button>
                    )}
            {/* Modal Content - Stop propagation to prevent closing when clicking inside */}
            <div
                ref={modalContentRef}
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Image Section */}
                <div className="modal-image-section"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {currentImage.is_video ? (
                        <video controls
                        src={imageUrlToDisplay}
                        alt={currentImage.filename}
                        className="modal-main-image"
                        style={{ transform: `translateX(${imageTranslateX}px)`, transition: 'transform 0.1s ease-out' }}
                        />
                    ) : (
                        <img
                            src={imageUrlToDisplay}
                            alt={currentImage.filename}
                            className="modal-main-image"
                            onClick={handleClick}
                            style={{ transform: `translateX(${imageTranslateX}px)`, transition: 'transform 0.1s ease-out' }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://placehold.co/1200x800/333333/FFFFFF?text=Image+Not+Found";
                            }}
                        />
                    )}
                </div>

                {/* Info Section (Metadata & Tags) */}
                <div className="modal-info-section">

                    {/* New TagCluster Component */}
                    <TagCluster
                        activeTagIds={imageTagIds}
                        onTagToggle={handleTagToggle} // Now passes the full tag object
                        canEdit={canModifyTags}
                        onTagsUpdated={fetchImageTags} // Refetch image tags if master list changes
                    />

                    {/* Metadata Section */}
                    <div className="modal-meta-section">
                        <h4 className="modal-section-subtitle">Metadata</h4>
                        <ul className="modal-general-info-list">
                            <li><strong className="modal-info-label">Path:</strong> {currentImage.path}</li>
                            <li><strong className="modal-info-label">Filename:</strong> {currentImage.filename}</li>
                            <li><strong className="modal-info-label">ID:</strong> {currentImage.id}</li>
                            <li><strong className="modal-info-label">Checksum:</strong> {currentImage.content_hash}</li>
                            <li><strong className="modal-info-label">Is Video:</strong> {currentImage.is_video ? 'Yes' : 'No'}</li>
                            <li><strong className="modal-info-label">Date Created:</strong> {new Date(currentImage.date_created).toLocaleString()}</li>
                            <li><strong className="modal-info-label">Date Modified:</strong> {new Date(currentImage.date_modified).toLocaleString()}</li>
                            <li><strong className="modal-info-label">Width:</strong> {currentImage.width}</li>
                            <li><strong className="modal-info-label">Height:</strong> {currentImage.height}</li>
                        </ul>
                        <div className="modal-metadata-box">
                            {renderMetadata(currentImage.exif_data)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ImageModal;
