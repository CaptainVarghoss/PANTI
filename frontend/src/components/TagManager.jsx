import React, { useState, useEffect } from 'react';
import ConfirmationDialog from './ConfirmDialog';
import { getStyles } from '../helpers/color_helper';
import { useAuth } from '../context/AuthContext';
import Switch from './Switch';
import Tooltip from './Tooltip';


function TagManager({allAvailableTags, setAllAvailableTags}) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    //const [allAvailableTags, setAllAvailableTags] = useState([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [tags, setTags] = useState([]);
    const [editingTagId, setEditingTagId] = useState(null);
    const [newTagMode, setNewTagMode] = useState(false);
    const [currentEditTag, setCurrentEditTag] = useState({});
    const [newTag, setNewTag] = useState({ name: '', color: '#000000', icon: '', admin_only: false });
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [error, setError] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [tagToDelete, setTagToDelete] = useState('');


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


    const updateTag = async (tagId, updatedData) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/tags/${tagId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update tag');
        }
        return response.json();
    };

    const addTag = async (newTagData) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/tags/`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(newTagData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add tag');
        }
        return response.json();
    };

    const delTag = async () => {
        if (!tagToDelete || tagToDelete == '') { return }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/tags/${tagToDelete}`, {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify(tagToDelete),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add tag');
        }
    };

    useEffect(() => {
        const getTags = async () => {
        try {
            const data = await fetchAllTags();
            setTags(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch tags.');
            console.error(err);
        } finally {
            setIsLoadingTags(false);
        }
        };
        getTags();
    }, []);

    useEffect(() => {
        fetchAllTags();
    }, []);

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCurrentEditTag(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleNewTagChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewTag(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleEditClick = (tag) => {
        setEditingTagId(tag.id);
        setCurrentEditTag({ ...tag });
        setNewTagMode(false);
    };

    const handleCancelEdit = () => {
        setEditingTagId(null);
        setCurrentEditTag({});
    };

    const handleDeleteTag = async (tagId) => {
        try {
            const response = await delTag(tagId);
        } catch (err) {
            setError(err.message || 'An error occured while deleting the tag.');
            console.error(err);
        } finally {
            fetchAllTags();
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        setIsUpdatingTags(true);
        setError(null);
        try {
            // Ensure the ID is correctly passed to the API function
            const response = await updateTag(editingTagId, currentEditTag);
            fetchAllTags();
            setEditingTagId(null);
            setCurrentEditTag({});
        } catch (err) {
            setError(err.message || 'An error occurred while updating the tag.');
            console.error(err);
        } finally {
            setIsUpdatingTags(false);
        }
    };

    const handleAddNewTagSubmit = async (e) => {
        e.preventDefault();
        setIsLoadingTags(true);
        setError(null);
        try {
            const response = await addTag(newTag);
            fetchAllTags();
            setNewTagMode(false);
        } catch (err) {
            setError(err.message || 'An error occurred while adding the tag.');
            console.error(err);
        } finally {
            setIsLoadingTags(false);
        }
    };

    const handleDeleteClick = (tagId) => {
        setTagToDelete(tagId);
        setShowConfirmDialog(true);
    };

    if (isLoadingTags) {
        return (
        <div className="loading-message">
            <p>Loading tags...</p>
        </div>
        );
    }

    if (error) {
        return (
        <div className="error-message">
            <p>{error}</p>
        </div>
        );
    }

    return (
        <div className="settings-container">

            {/* List of existing tags */}
            <div className="settings-group">
            {allAvailableTags.map(tag => {
                return (
                    <div key={tag.id} className="settings-item">
                    {editingTagId === tag.id ? (
                        <form onSubmit={handleUpdateSubmit} className="form-section">
                        <h3 className="form-heading">Editing Tag: <span className="tag-pill">{tag.name}</span></h3>
                        <div className="form-group">
                            <label htmlFor={`edit-name-${tag.id}`} className="form-label">Name</label>
                            <input
                            type="text"
                            id={`edit-name-${tag.id}`}
                            name="name"
                            value={currentEditTag.name || ''}
                            onChange={handleEditChange}
                            className="form-input"
                            required
                            />
                        </div>
                        <div className="checkbox-container">
                            <input
                            type="checkbox"
                            id={`edit-admin_only-${tag.id}`}
                            name="admin_only"
                            checked={currentEditTag.admin_only || false}
                            onChange={handleEditChange}
                            className="checkbox-input"
                            />
                            <label htmlFor={`edit-admin_only-${tag.id}`} className="checkbox-label">Admin Only</label>
                        </div>
                        <div className="form-actions">
                            <button
                            type='button'
                            onClick={() => handleDeleteClick(tag.id)}
                            className='button button-delete'
                            >
                            Delete
                            </button>
                            <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="button button-cancel"
                            >
                            Cancel
                            </button>
                            <button
                            type="submit"
                            className="button button-save"
                            >
                            Save
                            </button>
                        </div>
                        </form>
                    ) : (
                        <div className="tag-item-content">
                        <div className="tag-display-group">
                            <span
                            className="tag-pill"
                            >
                            {tag.name}
                            </span>
                            {tag.admin_only && (
                            <span className="tag-admin-badge">Admin</span>
                            )}
                        </div>
                        <button
                            onClick={() => handleEditClick(tag)}
                            className="button button-edit"
                        >
                            Edit
                        </button>
                        </div>
                    )}
                    </div>
                )
            })}
            </div>

            {/* Add New Tag Section */}
            <div className="settings-group">
            {!newTagMode ? (
                <button
                onClick={() => {
                    setNewTagMode(true);
                    setEditingTagId(null);
                }}
                className="button-add-new"
                >
                Add New Tag
                </button>
            ) : (
                <form onSubmit={handleAddNewTagSubmit} className="form-section">
                <h4 className="settings-group-title">Add New Tag</h4>
                <div className="settings-item">
                    <label htmlFor="new-name" className="settings-label">Name</label>
                    <input
                    type="text"
                    id="new-name"
                    name="name"
                    value={newTag.name}
                    onChange={handleNewTagChange}
                    className="settings-input"
                    required
                    />
                </div>
                <div className="checkbox-container">
                    <input
                    type="checkbox"
                    id="new-admin_only"
                    name="admin_only"
                    checked={newTag.admin_only}
                    onChange={handleNewTagChange}
                    className="settings-input"
                    />
                    <label htmlFor="new-admin_only" className="settings-label">Admin Only</label>
                </div>
                <div className="form-actions">
                    <button
                    type="button"
                    onClick={() => setNewTagMode(false)}
                    className="button button-cancel"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    className="button button-add-new"
                    >
                    Save Tag
                    </button>
                </div>
                </form>
            )}
            </div>
            <ConfirmationDialog
                isOpen={showConfirmDialog}
                onClose={() => {
                    setShowConfirmDialog(false);
                    setTagToDelete('');
                }}
                onConfirm={() => {
                    handleDeleteTag();
                    setShowConfirmDialog(false); // Close dialog after confirmation
                }}
                title="Delete Tag"
                message="Are you sure you want to delete this tag? This action cannot be undone."
                confirmText="Delete"
                cancelText="Keep"
                confirmButtonColor="#dc2626"
            />
        </div>
    );
};

export default TagManager;
