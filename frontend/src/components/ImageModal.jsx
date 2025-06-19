// frontend/src/components/ImageModal.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5'; // Using Ionicons for arrows and close
import { useAuth } from '../context/AuthContext'; // For authentication and current user/tags
import Select from 'react-select'; // For a user-friendly tag multi-select dropdown

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
function ImageModal({ isOpen, onClose, currentImage, images, onNavigate }) {
    const { token, isAuthenticated, settings, currentUser, fetchSettings } = useAuth(); // fetchSettings to get updated permissions if needed
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [allAvailableTags, setAllAvailableTags] = useState([]); // All tags from the backend
    const [selectedTags, setSelectedTags] = useState([]); // Tags currently assigned to the image in the modal
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');

    const [blobImageUrl, setBlobImageUrl] = useState(null);
    const [isFetchingOriginal, setIsFetchingOriginal] = useState(false);
    const [originalImageError, setOriginalImageError] = useState(null);

    const [touchStartX, setTouchStartX] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [imageTranslateX, setImageTranslateX] = useState(0);
    const SWIPE_THRESHOLD = 85; // Minimum horizontal distance for a swipe
    const TAP_THRESHOLD = 10; // Maximum distance for a tap to be considered a click

    const modalContentRef = useRef(null); // Renamed from modalRef to avoid confusion with the overlay click

    const usePreview = settings.enable_previews === true;

    // Effect to fetch all available tags when the modal opens
    useEffect(() => {
        if (!isOpen || !isAuthenticated) return;

        const fetchAllTags = async () => {
            setIsLoadingTags(true);
            try {
                const response = await fetch('/api/tags/', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setAllAvailableTags(data);
            } catch (error) {
                console.error('Error fetching all tags:', error);
            } finally {
                setIsLoadingTags(false);
            }
        };

        fetchAllTags();
    }, [isOpen, isAuthenticated, token]);

    // Effect to set the current image's tags when currentImage changes
    useEffect(() => {
        if (currentImage && allAvailableTags.length > 0) {
            // Map the currentImage's tags to the format expected by react-select
            const currentImageTags = currentImage.tags
                ? currentImage.tags.map(tag => ({
                      value: tag.id,
                      label: tag.name,
                      color: tag.color,
                      text_color: tag.text_color
                  }))
                : [];
            setSelectedTags(currentImageTags);
            setTagUpdateMessage('');
            setTagUpdateError('');
        }
    }, [currentImage, allAvailableTags]);

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

            const CHECKSUM = currentImage?.checksum;
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

    // Construct the proper image path is display
    let imageUrlToDisplay;
    const PREVIEWS_DIR = currentImage?.previews_path;
    const previewUrl = `${PREVIEWS_DIR}/${currentImage?.checksum}_preview.webp`;


    if (usePreview) {
        imageUrlToDisplay = previewUrl;
    } else {
        imageUrlToDisplay = blobImageUrl;
    }

    // Handle tag selection change in react-select
    const handleTagChange = (newTags) => {
        setSelectedTags(newTags || []); // Ensure it's always an array
    };

    // Save/Update tags to the backend
    const handleSaveTags = useCallback(async () => {
        if (!currentImage || !isAuthenticated || isUpdatingTags) return;

        setIsUpdatingTags(true);
        setTagUpdateMessage('');
        setTagUpdateError('');

        try {
            const tagIdsToUpdate = selectedTags.map(tag => tag.value);
            const payload = {
                tag_ids: tagIdsToUpdate
            };

            const response = await fetch(`/api/images/${currentImage.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to update tags: ${errorData.detail || response.statusText}`);
            }

            setTagUpdateMessage('Tags updated successfully!');
            // After successful update, ideally, you would want to update the image data
            // in the parent ImageGrid component to reflect the new tags.
            // For now, we rely on the modal's internal state.
        } catch (error) {
            console.error('Error saving tags:', error);
            setTagUpdateError(error.message);
        } finally {
            setIsUpdatingTags(false);
        }
    }, [currentImage, isAuthenticated, selectedTags, token, isUpdatingTags]);


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


    // Custom styles for react-select to match the general dark theme
    const customSelectStyles = {
        control: (provided) => ({
            ...provided,
            backgroundColor: '#374151', // Equivalent to bg-gray-700
            borderColor: '#4b5563', // Equivalent to border-gray-600
            color: '#d1d5db', // Equivalent to text-gray-300
            boxShadow: 'none',
            '&:hover': {
                borderColor: '#6b7280', // Equivalent to hover:border-gray-500
            },
        }),
        multiValue: (provided) => ({
            ...provided,
            backgroundColor: '#4ade80', // Equivalent to green-400 for tags
            color: '#1f2937', // Equivalent to text-gray-900
            borderRadius: '0.375rem', // Equivalent to rounded-md
        }),
        multiValueLabel: (provided) => ({
            ...provided,
            color: '#1f2937', // Equivalent to text-gray-900
        }),
        multiValueRemove: (provided) => ({
            ...provided,
            color: '#1f2937',
            '&:hover': {
                backgroundColor: '#dc2626', // Equivalent to red-600
                color: 'white',
            },
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#4b5563' : '#374151', // bg-gray-600 on focus, bg-gray-700 normally
            color: '#d1d5db', // Equivalent to text-gray-300
            '&:hover': {
                backgroundColor: '#4b5563',
            },
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: '#374151', // Equivalent to bg-gray-700
            borderColor: '#4b5563',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#d1d5db',
        }),
        input: (provided) => ({
            ...provided,
            color: '#d1d5db',
        }),
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
                    onClick={handleClick}
                >
                    <img
                        src={imageUrlToDisplay}
                        alt={currentImage.filename}
                        className="modal-main-image"
                        style={{ transform: `translateX(${imageTranslateX}px)`, transition: 'transform 0.1s ease-out' }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://placehold.co/1200x800/333333/FFFFFF?text=Image+Not+Found";
                        }}
                    />
                </div>

                {/* Info Section (Metadata & Tags) */}
                <div className="modal-info-section custom-scrollbar">
                    <h3 className="modal-info-title">Image Info</h3>

                    {/* Tags Section */}
                    <div className="modal-tags-section">
                        <h4 className="modal-section-subtitle">Tags</h4>
                        {isAuthenticated ? (
                            <>
                                <Select
                                    isMulti
                                    name="tags"
                                    options={allAvailableTags.map(tag => ({
                                        value: tag.id,
                                        label: tag.name,
                                        color: tag.color,
                                        text_color: tag.text_color
                                    }))}
                                    className="basic-multi-select"
                                    classNamePrefix="select"
                                    value={selectedTags}
                                    onChange={handleTagChange}
                                    isLoading={isLoadingTags}
                                    isDisabled={isUpdatingTags || !isAuthenticated}
                                    styles={customSelectStyles}
                                    placeholder="Select tags..."
                                />
                                <button
                                    onClick={handleSaveTags}
                                    className={`modal-save-tags-button ${isUpdatingTags ? 'modal-save-tags-button--loading' : ''}`}
                                    disabled={isUpdatingTags || !isAuthenticated}
                                >
                                    {isUpdatingTags ? 'Saving...' : 'Save Tags'}
                                </button>
                                {tagUpdateMessage && <p className="modal-success-message">{tagUpdateMessage}</p>}
                                {tagUpdateError && <p className="modal-error-message">{tagUpdateError}</p>}
                            </>
                        ) : (
                            <p className="modal-text-gray">Log in to manage tags.</p>
                        )}
                        <div className="modal-current-tags">
                            {currentImage.tags && currentImage.tags.length > 0 ? (
                                currentImage.tags.map(tag => (
                                    <span
                                        key={tag.id}
                                        className="modal-tag-pill"
                                        style={{ backgroundColor: tag.color, color: tag.text_color }}
                                    >
                                        {tag.name}
                                    </span>
                                ))
                            ) : (
                                <p className="modal-text-gray">No tags assigned.</p>
                            )}
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div>
                        <h4 className="modal-section-subtitle">Metadata</h4>
                        <div className="modal-metadata-box custom-scrollbar">
                            {renderMetadata(currentImage.meta)}
                        </div>
                        <h4 className="modal-section-subtitle modal-general-info-title">General Info</h4>
                        <ul className="modal-general-info-list">
                            <li><strong className="modal-info-label">Filename:</strong> {currentImage.filename}</li>
                            <li><strong className="modal-info-label">Path:</strong> {currentImage.path}</li>
                            <li><strong className="modal-info-label">Checksum:</strong> {currentImage.checksum}</li>
                            <li><strong className="modal-info-label">Is Video:</strong> {currentImage.is_video ? 'Yes' : 'No'}</li>
                            <li><strong className="modal-info-label">Date Created:</strong> {new Date(currentImage.date_created).toLocaleString()}</li>
                            <li><strong className="modal-info-label">Date Modified:</strong> {new Date(currentImage.date_modified).toLocaleString()}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ImageModal;
