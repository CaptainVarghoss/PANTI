import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { IoClose } from 'react-icons/io5';


/**
 * A custom hook to handle clicks outside of a specified element.
 * @param {React.RefObject} ref - The ref of the element to monitor.
 * @param {Function} handler - The function to call when a click outside occurs.
 */
function useOutsideAlerter(ref, handler) {
    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                handler();
            }
        }
        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, handler]);
}

// A simple event bus for communication between TagCluster components
const tagUpdateManager = new EventTarget();

/**
 * A self-contained component to display and manage tags for different entity types.
 * It exports two sub-components: `TagCluster.Display` and `TagCluster.Popup`.
 */
const TagCluster = () => null; // Base component does nothing itself.

/**
 * Displays the active tags for a given item.
 * @param {string} type - The type of the item (e.g., 'filter_tags', 'filter_neg_tags').
 * @param {number} itemId - The ID of the item.
 */
TagCluster.Display = function TagDisplay({ type, itemId }) {
    const { token } = useAuth();
    const [activeTags, setActiveTags] = useState([]);

    const fetchActiveTags = useCallback(async () => {

        const fetchActiveTags = async () => {
            // This logic can be expanded to handle different types like 'image' or 'folder'
            if (type.startsWith('filter')) {
                const response = await fetch(`/api/filters/${itemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const filter = await response.json();
                    const tagObjects = type === 'filter_tags' ? filter.tags : filter.neg_tags;
                    setActiveTags(tagObjects || []);
                }
            } else if (type === 'imagepath_tags') {
                const response = await fetch(`/api/imagepaths/${itemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const pathData = await response.json();
                    // Assuming the API returns tags directly in a 'tags' property
                    setActiveTags(pathData.tags || []);
                }
            } else if (type === 'image_tags') {
                const response = await fetch(`/api/tags/?imageId=${itemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const imageData = await response.json();
                    // This endpoint returns an array of tags directly
                    setActiveTags(imageData || []);
                }
            }
        };

        fetchActiveTags();
    }, [type, itemId, token]);

    useEffect(() => {
        if (!type || !itemId) return;

        fetchActiveTags(); // Initial fetch

        // Listener for updates from the Popup component
        const handleTagsUpdated = (event) => {
            if (event.detail.itemId === itemId && event.detail.type === type) {
                fetchActiveTags(); // Refetch if the update is for this component
            }
        };

        tagUpdateManager.addEventListener('tagsUpdated', handleTagsUpdated);

        // Cleanup listener on unmount
        return () => tagUpdateManager.removeEventListener('tagsUpdated', handleTagsUpdated);
    }, [type, itemId, fetchActiveTags]);

    return (
        <div className="tag-display-container">
            {activeTags.map(tag => (
                <span key={tag.id} className="tag-badge active">
                    {tag.name}
                </span>
            ))}
        </div>
    );
};

/**
 * Renders a popup menu for toggling tags on an item.
 * @param {string} type - The type of the item (e.g., 'filter_tags', 'filter_neg_tags').
 * @param {number} itemId - The ID of the item.
 * @param {Function} onClose - Callback to close the popup.
 */
TagCluster.Popup = function TagPopup({ type, itemId, onClose, onTagSelect }) {
    const { token, isAdmin, settings } = useAuth();
    const wrapperRef = useRef(null);
    useOutsideAlerter(wrapperRef, onClose);

    const [allTags, setAllTags] = useState([]);
    const [activeTagIds, setActiveTagIds] = useState(new Set());
    const [error, setError] = useState(null);

    const canModifyTags = isAdmin || (settings?.allow_tag_add === true);

    // Fetch all available tags and the item's current tags
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all tags
                const tagsResponse = await fetch('/api/tags/', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!tagsResponse.ok) throw new Error('Failed to fetch all tags');
                const tagsData = await tagsResponse.json();
                setAllTags(tagsData);

                // Fetch the specific filter to get its current tags
                if (type.startsWith('filter') && itemId) {
                    const filterResponse = await fetch(`/api/filters/${itemId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!filterResponse.ok) throw new Error('Failed to fetch filter details');
                    const filterData = await filterResponse.json();
                    // The API returns full tag objects in `tags` and `neg_tags` arrays.
                    // We need to extract the IDs from these objects.
                    const tagObjects = type === 'filter_tags' ? filterData.tags : filterData.neg_tags;
                    setActiveTagIds(new Set((tagObjects || []).map(tag => tag.id)));
                }
                // Handle imagepath_tags
                else if (type === 'imagepath_tags' && itemId) {
                    const pathResponse = await fetch(`/api/imagepaths/${itemId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!pathResponse.ok) throw new Error('Failed to fetch image path details');
                    const pathData = await pathResponse.json();
                    const tagObjects = pathData.tags;
                    setActiveTagIds(new Set((tagObjects || []).map(tag => tag.id)));
                } else if (type === 'image_tags' && itemId) {
                    const imageResponse = await fetch(`/api/tags/?imageId=${itemId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!imageResponse.ok) throw new Error('Failed to fetch image details');
                    const imageData = await imageResponse.json();
                    // This endpoint returns an array of tags directly.
                    // We just need their IDs.
                    setActiveTagIds(new Set((imageData || []).map(tag => tag.id)));
                }

            } catch (err) {
                setError(err.message);
            }
        };
        fetchData();
    }, [type, itemId, token]);

    const handleTagToggle = useCallback(async (tag) => {
        // If onTagSelect is provided, we are in selection mode for the search bar.
        if (onTagSelect) {
            onTagSelect(tag);
            return; // Don't proceed with updating tags on an item.
        }

        const newActiveTagIds = new Set(activeTagIds);
        if (newActiveTagIds.has(tag.id)) {
            newActiveTagIds.delete(tag.id);
        } else {
            newActiveTagIds.add(tag.id);
        }

        // Optimistically update the UI
        setActiveTagIds(newActiveTagIds);

        // Persist the change to the backend
        try {
            let response;
            if (type.startsWith('filter')) {
                const field = type === 'filter_tags' ? 'tag_ids' : 'neg_tag_ids';
                const payload = { [field]: Array.from(newActiveTagIds) };
                response = await fetch(`/api/filters/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else if (type === 'imagepath_tags') {
                const payload = { tag_ids: Array.from(newActiveTagIds) };
                response = await fetch(`/api/imagepaths/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else if (type === 'image_tags') {
                // This endpoint is specifically for updating tags on an image
                const payload = { tag_ids: Array.from(newActiveTagIds) };
                response = await fetch(`/api/images/${itemId}/tags`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                throw new Error('Failed to update tags.');
            }

            // Dispatch a custom event to notify Display components of the change
            tagUpdateManager.dispatchEvent(new CustomEvent('tagsUpdated', {
                detail: { itemId, type }
            }));

        } catch (err) {
            setError(err.message);
            // Revert optimistic update on error (optional, could refetch)
        }
    }, [activeTagIds, type, itemId, token, onTagSelect]);

    if (!canModifyTags) {
        return <div ref={wrapperRef} className="tag-cluster-popup">
            <p className="error-text">You do not have permission to modify tags.</p>
        </div>;
    }

    if (error) return <div ref={wrapperRef} className="tag-cluster-popup"><p className="error-text">{error}</p></div>;

    return (
        <div ref={wrapperRef} className="tag-cluster-popup">
            <button className="tag-cluster-close-btn" onClick={onClose} title="Close">
                <IoClose size={18} />
            </button>
            {allTags.map(tag => {
                const isActive = activeTagIds.has(tag.id);
                const tagClasses = `tag-badge ${isActive ? 'active' : ''}`;
                return (
                    <span
                        key={tag.id}
                        className={tagClasses}
                        onClick={() => handleTagToggle(tag)}
                    >
                        {tag.name}
                    </span>
                );
            })}
        </div>
    );
}

export default TagCluster;