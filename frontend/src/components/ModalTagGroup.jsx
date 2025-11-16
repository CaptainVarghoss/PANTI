import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";
import { IoMdCloseCircle } from "react-icons/io";

function ModalTagGroup({ searchTerm, setSearchTerm, currentImage, onClose }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [allAvailableTags, setAllAvailableTags] = useState([]); // All tags from the backend based on 'group'
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');
    const [imageTags, setImageTags] = useState([]);
    const [showEdit, setShowEdit] = useState(false);

    const canModifyTags = isAdmin || (settings?.allow_tag_add === true);

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
            console.error('Error fetching image tags:', error);
        } finally {
            setIsLoadingTags(false);
        }
    }, [currentImage, token]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAllTags();
            fetchImageTags();
        }
    }, [isAuthenticated, fetchAllTags, fetchImageTags]);

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
    }, [currentImage, isAuthenticated, imageTags, token, isUpdatingTags, fetchImageTags]);

    const handleTagClick = (tag) => {
        if (showEdit) {
            // remove tag

        } else {
            setSearchTerm(`TAG: ${tag.name}`);
            if (onClose) {
                onClose();
            }
        }
    }

    const handleAddTag = useCallback(async (tagId) => {
        if (canModifyTags && tagId && currentImage) { // Ensure currentImage exists
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
        if (canModifyTags && tagId && currentImage) {
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
            <div className="modal-tag-container">
                <div className="modal-tag-header">
                    <h4 className="modal-section-subtitle">Tags</h4>
                </div>
                <div className="modal-tag-box">
                    <div className="modal-current-tags">
                        {relevantTags && relevantTags.length > 0 ? (
                            relevantTags.map(tag => {
                                return (
                                    <span
                                        key={tag.id}
                                        onClick={() => handleTagClick(tag)}
                                        className="tag-pill"
                                    >
                                        {tag.name}
                                        {showEdit && canModifyTags &&
                                            <button
                                                className="tag-pill-edit"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent parent span's onClick
                                                    handleRemoveTag(tag.id);
                                                }}
                                            >
                                                <IoMdCloseCircle size={20} /> {/* Example icon */}
                                            </button>
                                        }
                                    </span>
                                );
                            })
                        ) : (
                            <p className="modal-text-gray">No tags assigned.</p>
                        )}
                    </div>
                    {showEdit && canModifyTags &&
                        <div className="modal-add-tags">
                            <div className="modal-add-tag-header">
                                <h4>Available Tags</h4>
                            </div>
                            <div className="modal-add-tag-tags">
                                {allAvailableTags && allAvailableTags.length > 0 ? (
                                    allAvailableTags.map(tag => {
                                        return (
                                            <span
                                                key={tag.id}
                                                onClick={() => handleAddTag(tag.id)}
                                                className="tag-pill add-tag-pill"
                                            >
                                                {tag.name}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <p className="modal-text-gray">No more tags to add.</p>
                                )}
                            </div>
                        </div>
                    }
                </div>
                <div className="modal-tag-edit">
                    {canModifyTags &&
                        <button className="icon-button" onClick={handleShowEdit}>
                            <MdEdit size={20} />
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}

export default ModalTagGroup;