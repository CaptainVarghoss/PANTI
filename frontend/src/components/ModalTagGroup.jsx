import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";

function ModalTagGroup({ searchTerm, setSearchTerm, currentImage, onClose }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [allAvailableTags, setAllAvailableTags] = useState([]); // All tags from the backend based on 'group'
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');
    const [imageTags, setImageTags] = useState([]);
    const [showEdit, setShowEdit] = useState(false);

    let relevantTags = allAvailableTags
    if (currentImage) {
        relevantTags = imageTags
    }

    useEffect(() => {
        if (allAvailableTags.length > 0) {
            const imageTagIds = new Set(imageTags.map(tag => tag.id));

            const filteredTags = allAvailableTags.filter(tag => !imageTagIds.has(tag.id));
            setAllAvailableTags(filteredTags);
        }
    }, [imageTags]);

    const fetchAllTags = useCallback(async () => {
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
    }, [token]);

    const fetchImageTags = useCallback(async () => {
        if (!currentImage || !currentImage.id) {
            setImageTags([]);
            return;
        }

        setIsLoadingTags(true);
        try {
            const response = await fetch(`/api/tags/?imageId=${currentImage.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setImageTags(data);
        } catch (error) {
            console.error('Error fetching all tags:', error);
        } finally {
            setIsLoadingTags(false);
        }
    }, [currentImage, token]);

    // Effect to fetch all available tags
    useEffect(() => {
        fetchAllTags();
    }, [fetchAllTags]);

    useEffect(() => {
        fetchImageTags();
    }, [fetchImageTags]);

    const handleShowEdit = () => {
        setShowEdit(!showEdit);
    };

    // Save/Update tags to the backend
    const handleSaveTags = useCallback(async (tagsToSave) => {
        if (!currentImage || !isAuthenticated || isUpdatingTags) return;

        setIsUpdatingTags(true);
        setTagUpdateMessage('');
        setTagUpdateError('');

        try {
            const tagsToUse = tagsToSave || imageTags;
            const tagIdsToUpdate = tagsToUse.map(tag => tag.value || tag.id);
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
            fetchImageTags();
        } catch (error) {
            console.error('Error saving tags:', error);
            setTagUpdateError(error.message);
        } finally {
            setIsUpdatingTags(false);
        }
    }, [currentImage, isAuthenticated, imageTags, token, isUpdatingTags]);

    const handleTagClick = (tag) => {
        if (showEdit) {
            // remove tag

        } else {
            e.preventDefault();
            setSearchTerm(`TAG: ${tag.name}`);
        }
    }

    const handleAddTag = useCallback(async (tagId) => {
        if (isAdmin && tagId && currentImage) { // Ensure currentImage exists
            const tagToAdd = allAvailableTags.find(tag => tag.id === tagId);

            if (tagToAdd && !imageTags.some(tag => tag.id === tagId)) {
                // Optimistically update the UI
                const newImageTags = [...imageTags, tagToAdd];
                setImageTags(newImageTags);

                // Filter out the added tag from allAvailableTags
                setAllAvailableTags(prevAvailable => prevAvailable.filter(tag => tag.id !== tagId));

                await handleSaveTags(newImageTags);
            }
        }
    }, [isAdmin, allAvailableTags, imageTags, currentImage]);

    const handleRemoveTag = useCallback(async (tagId) => {
        if (isAdmin && tagId && currentImage) {
            const tagToRemove = imageTags.find(tag => tag.id === tagId);

            if (tagToRemove) {
                // Optimistically update the UI
                const newImageTags = imageTags.filter(tag => tag.id !== tagId);
                setImageTags(newImageTags);

                // Add the removed tag back to the available tags list
                setAllAvailableTags(prevAvailable => {
                    if (!prevAvailable.some(tag => tag.id === tagId)) {
                        return [...prevAvailable, tagToRemove];
                    }
                    return prevAvailable;
                });

                await handleSaveTags(newImageTags);
            }
        }
    }, [isAdmin, imageTags, allAvailableTags, currentImage, handleSaveTags]);

    return (
        <div className="modal-tags-section">
            <div className="">
                <div className="modal-tag-header">
                    <h4 className="modal-section-subtitle">Tags</h4>
                    {isAdmin &&
                        <button onClick={handleShowEdit}>
                            <MdEdit size={20} />
                        </button>
                    }
                </div>
                <div className="modal-current-tags">
                    {relevantTags && relevantTags.length > 0 ? (
                        relevantTags.map(tag => (
                            <span
                                key={tag.id}
                                onClick={(e) => { e.preventDefault(); setSearchTerm(`TAG: ${tag.name}`); onClose();}}
                                className="modal-tag-pill"
                                style={{ backgroundColor: tag.color, color: tag.text_color }}
                            >
                                {tag.name}
                                {showEdit &&
                                    <button
                                        className="modal-tag-pill-edit"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveTag(tag.id);
                                        }}
                                    >X
                                    </button>
                                }
                            </span>
                        ))
                    ) : (
                        <p className="modal-text-gray">No tags assigned.</p>
                    )}
                </div>
                {showEdit &&
                    <div className="modal-current-tags modal-add-tags">
                        {allAvailableTags && allAvailableTags.length > 0 &&
                            allAvailableTags.map(tag => (
                                <span
                                    key={tag.id}
                                    onClick={() => handleAddTag(tag.id)}
                                    className="modal-tag-pill"
                                    style={{ backgroundColor: tag.color, color: tag.text_color }}
                                >
                                    {tag.name}
                                </span>
                            ))
                        }
                    </div>
                }
            </div>
        </div>
    )
}<p className="modal-text-gray">No tags assigned.</p>

export default ModalTagGroup;