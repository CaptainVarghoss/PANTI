import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";
import {getStyles} from '../helpers/color_helper';

function TagGroup({ imageId = 0, searchTerm, setSearchTerm, currentImage, onClose, setSubPanel }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [allAvailableTags, setAllAvailableTags] = useState([]); // All tags from the backend based on 'group'
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');

    const canModifyTags = isAdmin || (settings?.allow_tag_add === true);

    // Effect to fetch all available tags
    useEffect(() => {
        if (!isAuthenticated) return;

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
    }, []);

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

    return (
        <div className="sidebar-tag-section">
            <div className="sidebar-tag-container">
                <div className="sidebar-tag-header">
                    <h4 className="sidebar-section-subtitle">Tags</h4>
                    <div className="sidebar-tag-edit">
                        {canModifyTags &&
                            <button className="icon-button" onClick={(e) => { e.preventDefault(); setSubPanel('tagEdit'); }}>
                                <MdEdit size={20} />
                            </button>
                        }
                    </div>
                </div>
                <div className="sidebar-current-tags">
                    {allAvailableTags && allAvailableTags.length > 0 ? (
                        allAvailableTags.map(tag => {
                            const styles = getStyles(tag.color);
                            return (
                                <span
                                    key={tag.id}
                                    onClick={(e) => { e.preventDefault(); setSearchTerm(`TAG: ${tag.name}`); onClose();}}
                                    className="sidebar-tag-pill"
                                    style={styles}
                                >
                                    {tag.name}
                                </span>
                            )
                        })
                    ) : (
                        <p className="sidebar-text-gray">No tags assigned.</p>
                    )}
                </div>
            </div>
        </div>
    )
}<p className="sidebar-text-gray">No tags assigned.</p>

export default TagGroup;