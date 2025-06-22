import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Select from 'react-select';

function TagGroup({ imageId = 0, searchTerm, setSearchTerm, currentImage, onClose }) {
    const { token, isAuthenticated, settings } = useAuth();

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [allAvailableTags, setAllAvailableTags] = useState([]); // All tags from the backend based on 'group'
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [tagUpdateMessage, setTagUpdateMessage] = useState('');
    const [tagUpdateError, setTagUpdateError] = useState('');
    // FIX THIS - maybe not needed selectedTags
    const [selectedTags, setSelectedTags] = useState([]);

    // Effect to fetch all available tags
    useEffect(() => {
        if (!isAuthenticated) return;

        let endpoint = '';
        if (imageId != 0) {
            const queryString = new URLSearchParams();
            queryString.append('imageId', imageId);
            endpoint = `/api/tags/?${queryString.toString()}`;
        } else {
            endpoint = '/api/tags/';
        }

        const fetchAllTags = async () => {
            setIsLoadingTags(true);
            try {
                const response = await fetch(endpoint, {
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
        <div className="modal-tags-section">
            <div className="">
                <h4 className="modal-section-subtitle">Tags</h4>
                {isAuthenticated && imageId !== 0 &&
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
                }
                <div className="modal-current-tags">
                    {allAvailableTags && allAvailableTags.length > 0 ? (
                        allAvailableTags.map(tag => (
                            <span
                                key={tag.id}
                                onClick={(e) => { e.preventDefault(); setSearchTerm(`TAG: ${tag.name}`); onClose();}}
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
        </div>
    )
}<p className="modal-text-gray">No tags assigned.</p>

export default TagGroup;