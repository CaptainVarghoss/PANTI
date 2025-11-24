import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import TagCluster from './TagCluster';
import ImagePathsManagement from './ImagePathsManagement';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm';
import GlobalSettingsForm from './GlobalSettingsForm';
import FilterManager from './FilterManager';

const AccordionItem = ({ title, children, isOpen, onClick }) => (
    <div className="accordion-item">
        <button className={`accordion-title ${isOpen ? 'open' : ''}`} onClick={onClick}>
            <span>{title}</span>
            <span className={`accordion-icon ${isOpen ? 'open' : ''}`}>{'>'}</span>
        </button>
        <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
            <div className="accordion-content-inner">
                {children}
            </div>
        </div>
    </div>
);


/**
 * A unified modal component for displaying either an image with details or application settings.
 * The behavior and content are determined by the `modalType` prop.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {function} props.onClose - Callback function to close the modal.
 * @param {string} props.modalType - Type of modal to display ('image' or 'settings').
 * @param {object} [props.modalProps] - Props specific to the modal type.
 *    For 'image': { currentImage, images, onNavigate, searchTerm, setSearchTerm }
 *    For 'settings': { filters, setFilters }
 */
function Modal({ isOpen, onClose, modalType, modalProps = {} }) { // eslint-disable-line no-unused-vars
    const { token, isAuthenticated, settings, isAdmin, logout } = useAuth();
    const modalContentRef = useRef(null);

    // --- General Modal Logic ---
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
            // Image modal specific keybindings
            if (modalType === 'image') {
                if (event.key === 'ArrowRight' && canGoNext) {
                    handleNext();
                } else if (event.key === 'ArrowLeft' && canGoPrev) {
                    handlePrev();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, modalType, modalProps]); // Dependencies will be specific to handlers

    // --- Settings Modal State and Logic ---
    const [openSections, setOpenSections] = useState({});
    const { filters, setFilters } = modalProps;

    const handleAccordionClick = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    const handleLogout = () => {
        logout();
        onClose();
    };

    // --- Image Modal State and Logic ---
    const { currentImage, images, onNavigate, searchTerm, setSearchTerm } = modalProps;
    const [blobImageUrl, setBlobImageUrl] = useState(null);
    const [isFetchingOriginal, setIsFetchingOriginal] = useState(false);
    const [originalImageError, setOriginalImageError] = useState(null);
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [imageTranslateX, setImageTranslateX] = useState(0);
    const [imageTagIds, setImageTagIds] = useState(new Set());
    const [isTagsLoading, setIsTagsLoading] = useState(false);
    const [tagsError, setTagsError] = useState(null);

    const usePreview = settings?.enable_previews === true;
    const SWIPE_THRESHOLD = 85;
    const TAP_THRESHOLD = 10;

    useEffect(() => {
        if (modalType !== 'image') return;

        if (blobImageUrl) {
            URL.revokeObjectURL(blobImageUrl);
            setBlobImageUrl(null);
        }

        if (!isOpen || !currentImage || usePreview || !isAuthenticated) return;

        const fetchOriginalImage = async () => {
            setIsFetchingOriginal(true);
            setOriginalImageError(null);
            const { content_hash: CHECKSUM, filename: FILENAME } = currentImage;

            if (!CHECKSUM || !FILENAME) {
                setOriginalImageError("Image data missing (checksum or filename).");
                setIsFetchingOriginal(false);
                return;
            }

            try {
                const response = await fetch(`/api/images/original/${CHECKSUM}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) throw new Error(`Failed to load original image: ${response.statusText}`);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setBlobImageUrl(url);
            } catch (error) {
                console.error('Error fetching original image:', error);
                setOriginalImageError(error.message);
                setBlobImageUrl(null);
            } finally {
                setIsFetchingOriginal(false);
            }
        };

        fetchOriginalImage();

        return () => {
            if (blobImageUrl) {
                URL.revokeObjectURL(blobImageUrl);
                setBlobImageUrl(null);
            }
        };
    }, [isOpen, currentImage, usePreview, isAuthenticated, token, modalType]);

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
        if (isOpen && modalType === 'image') {
            fetchImageTags();
        }
    }, [isOpen, modalType, fetchImageTags]);

    const updateImageTags = async (newTagIdsSet) => {
        if (!currentImage?.id || !canModifyTags) return;
        try {
            await fetch(`/api/images/${currentImage.id}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tag_ids: Array.from(newTagIdsSet) }),
            });
        } catch (error) {
            console.error('Error saving tags:', error);
            setTagsError(error.message);
            fetchImageTags(); // Revert optimistic update
        }
    };

    const handleTagToggle = (tag) => {
        if (!canModifyTags) {
            if (tag?.name) {
                setSearchTerm(`TAG:"${tag.name}"`);
                onClose();
            }
            return;
        }
        const newTagIds = new Set(imageTagIds);
        if (newTagIds.has(tag.id)) {
            newTagIds.delete(tag.id);
        } else {
            newTagIds.add(tag.id);
        }
        setImageTagIds(newTagIds);
        updateImageTags(newTagIds);
    };

    let imageUrlToDisplay;
    if (modalType === 'image') {
        const PREVIEWS_DIR = currentImage?.previews_path;
        const previewUrl = `${PREVIEWS_DIR}/${currentImage?.checksum}_preview.webp`;
        imageUrlToDisplay = usePreview ? previewUrl : blobImageUrl;
    }

    const currentIndex = (modalType === 'image' && currentImage) ? images.findIndex(img => img.id === currentImage.id) : -1;
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

    const handleTouchStart = useCallback((e) => {
        setTouchStartX(e.touches[0].clientX);
        setTouchStartY(e.touches[0].clientY);
        setImageTranslateX(0);
    }, []);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        const diffX = e.touches[0].clientX - touchStartX;
        setImageTranslateX(Math.max(-window.innerWidth / 1.5, Math.min(window.innerWidth / 1.5, diffX)));
    }, [touchStartX]);

    const handleTouchEnd = useCallback((e) => {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        setImageTranslateX(0);

        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            if (diffX > 0 && canGoPrev) handlePrev();
            else if (diffX < 0 && canGoNext) handleNext();
        } else if (Math.abs(diffX) <= TAP_THRESHOLD && Math.abs(diffY) <= TAP_THRESHOLD) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
        setTouchStartX(0);
        setTouchStartY(0);
    }, [touchStartX, touchStartY, canGoPrev, canGoNext, handlePrev, handleNext, onClose]);

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
            return <p className="modal-error-text">Failed to parse metadata.</p>;
        }
    };

    // --- Render Logic ---
    if (!isOpen) return null;

    const renderImageModalContent = () => (
        <>
            {/* Navigation Buttons */}
            {canGoPrev && (
                <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="modal-nav-button modal-nav-button--prev" title="Previous Image">
                    <IoChevronBack size={32} />
                </button>
            )}
            {canGoNext && (
                <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="modal-nav-button modal-nav-button--next" title="Next Image">
                    <IoChevronForward size={32} />
                </button>
            )}
            <div ref={modalContentRef} className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-image-section" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                    {currentImage.is_video ? (
                        <video controls src={imageUrlToDisplay} alt={currentImage.filename} className="modal-main-image" style={{ transform: `translateX(${imageTranslateX}px)`, transition: 'transform 0.1s ease-out' }} />
                    ) : (
                        <img
                            src={imageUrlToDisplay}
                            alt={currentImage.filename}
                            className="modal-main-image"
                            onClick={onClose}
                            style={{ transform: `translateX(${imageTranslateX}px)`, transition: 'transform 0.1s ease-out' }}
                            onError={(e) => { e.target.src = "https://placehold.co/1200x800/333333/FFFFFF?text=Image+Not+Found"; }}
                        />
                    )}
                </div>
                <section>
                    <TagCluster activeTagIds={imageTagIds} onTagToggle={handleTagToggle} canEdit={canModifyTags} onTagsUpdated={fetchImageTags} />
                    <div className="section-container">
                        <h3 className="section-header">Metadata</h3>
                        <ul className="section-list">
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
                </section>
            </div>
        </>
    );

    const renderSettingsModalContent = () => (
        <div ref={modalContentRef} className="modal-content" onClick={(e) => e.stopPropagation()}>
            <section>
                <div className="modal-header">
                    <h2 className="modal-title">Settings</h2>
                </div>
                <div className="settings-modal-body">
                    <div className="section-container">
                        <ImagePathsManagement />
                    </div>
                    <div className="section-container">
                        <FilterManager filters={filters} setFilters={setFilters} />
                    </div>
                    <div className="section-container">
                        <DeviceSpecificSettingsForm />
                    </div>
                    {isAdmin && (
                        <div className="section-container">
                            <GlobalSettingsForm />
                        </div>
                    )}
                </div>
                <div className="section-container">
                    <button onClick={handleLogout} className="btn-base btn-red settings-logout-button">Logout</button>
                </div>
            </section>
        </div>
    );

    const renderGenericModalContent = () => {
        const { ContentComponent, ...restProps } = modalProps;
        if (!ContentComponent) return null;

        // Pass down relevant props to the content component
        const contentProps = {
            ...restProps,
            onClose: onClose, // Provide the onClose handler to the inner component
        };

        return (
            <div ref={modalContentRef} className="modal-content" onClick={(e) => e.stopPropagation()}><ContentComponent {...contentProps} /></div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="btn-base btn-primary modal-close-button" title="Close">
                <IoClose size={24} />
            </button>

            {modalType === 'image' && currentImage && renderImageModalContent()}
            {modalType === 'settings' && renderSettingsModalContent()}
            {modalProps.ContentComponent && renderGenericModalContent()}
        </div>
    );
}

export default Modal;