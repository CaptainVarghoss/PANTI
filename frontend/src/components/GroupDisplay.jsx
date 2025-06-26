import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";
import { getStyles } from '../helpers/color_helper';

/**
 * A generalized component to display groups of items (like tags or filters).
 *
 * @param {object} props - The component's props.
 * @param {string} props.title - The title to display for the group (e.g., "Tags", "Content Filters").
 * @param {string} props.apiEndpoint - The API endpoint to fetch the items (e.g., "/api/tags/", "/api/filters/").
 * @param {string} props.editPanelName - The name of the sub-panel to open for editing (e.g., "tagEdit", "filterEdit").
 * @param {function} props.setSubPanel - Function to set the sub-panel state.
 * @param {function} [props.onItemClick] - Optional callback function when an item is clicked. Receives the item object.
 * @param {boolean} [props.allowEdit] - Whether the edit button should be displayed. Defaults to false.
 * @param {string} [props.itemType] - A string describing the type of item (e.g., "tags", "filters") for display messages.
 */
function GroupDisplay({
    imageId = 0,
    searchTerm,
    setSearchTerm,
    currentImage,
    onClose,
    title,
    apiEndpoint,
    editPanelName,
    setSubPanel,
    onItemClick,
    itemType = "items" // Default for messages like "No items assigned."
}) {
    const { token, isAuthenticated, isAdmin } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState([]);
    // Update/save logic (like handleSaveTags) is best handled by the parent
    // or through more specific props if genuinely shared across other item types.
    // For this generalized component, we'll focus on fetching and displaying.
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');

    const allowEdit = isAdmin || (settings?.allow_tag_add === true);
    // Effect to fetch all available items
    useEffect(() => {
        if (!isAuthenticated || !apiEndpoint) return;

        const fetchItems = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(apiEndpoint, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setItems(data);
            } catch (error) {
                console.error(`Error fetching ${itemType}:`, error);
                // Optionally set an error state to display to the user
            } finally {
                setIsLoading(false);
            }
        };

        fetchItems();
    }, [isAuthenticated, apiEndpoint, token, itemType]);

    const handleItemClick = useCallback((item, e) => {
        e.preventDefault();
        if (onItemClick) {
            onItemClick(item);
        }
    }, [onItemClick]);

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
        } catch (error) {
            console.error('Error saving tags:', error);
            setTagUpdateError(error.message);
        } finally {
            setIsUpdatingTags(false);
        }
    }, [currentImage, isAuthenticated, token, isUpdatingTags]);

    const handleTagClick = (tag) => {
        // This is the original TagGroup behavior
        setSearchTerm(`TAG: ${tag.name}`);
        onClose();
    };

    return (
        // Use a generic class name, or pass it as a prop if needed for specific styling
        <div className={`sidebar-${itemType}-section`}>
            <div className={`sidebar-${itemType}-container`}>
                <div className={`sidebar-${itemType}-header`}>
                    <h4 className="sidebar-section-subtitle">{title}</h4>
                    <div className={`sidebar-${itemType}-edit`}>
                        {allowEdit &&
                            <button className="icon-button" onClick={(e) => { e.preventDefault(); setSubPanel(editPanelName); }}>
                                <MdEdit size={20} />
                            </button>
                        }
                    </div>
                </div>
                <div className={`sidebar-current-${itemType}`}>
                    {isLoading ? (
                        <p className="sidebar-text-gray">Loading {itemType}...</p>
                    ) : items && items.length > 0 ? (
                        items.map(item => {
                            const styles = getStyles(item.color);
                            return (
                                <span
                                    key={item.id}
                                    onClick={(e) => handleTagClick(item, e)}
                                    // You can pass a className prop or make it dynamic if different styles are needed
                                    className={`sidebar-${itemType}-pill`}
                                    style={styles}
                                >
                                    {item.name}
                                </span>
                            );
                        })
                    ) : (
                        <p className="sidebar-text-gray">No {itemType} assigned.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GroupDisplay;