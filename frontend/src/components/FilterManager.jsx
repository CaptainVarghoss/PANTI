import React, { useState, useEffect } from 'react';
import ConfirmationDialog from './ConfirmDialog';
import { getStyles } from '../helpers/color_helper';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";
import { FaCirclePlus } from "react-icons/fa6";


function FilterManager({filters, setFilters}) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [isLoadingFilters, setIsLoadingFilters] = useState(false);
    const [editingFilterId, setEditingFilterId] = useState(null);
    const [newFilterMode, setNewFilterMode] = useState(false);
    const [currentEditFilter, setCurrentEditFilter] = useState({});
    const [newFilter, setNewFilter] = useState({ name: '', color: '#000000', icon: '', admin_only: false });
    const [isUpdatingFilters, setIsUpdatingFilters] = useState(false);
    const [error, setError] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [filterToDelete, setFilterToDelete] = useState('');


    const updateFilter = async (filterId, updatedData) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/filters/${filterId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update filter');
        }
        return response.json();
    };

    const addFilter = async (newFilterData) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/filters/`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(newFilterData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add filter');
        }
        return response.json();
    };

    const delFilter = async () => {
        if (!filterToDelete || filterToDelete == '') { return }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/filters/${filterToDelete}`, {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify(filterToDelete),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add filter');
        }
    };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCurrentEditFilter(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleNewFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewFilter(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleEditClick = (filter) => {
        setEditingFilterId(filter.id);
        setCurrentEditFilter({ ...filter });
        setNewFilterMode(false);
    };

    const handleCancelEdit = () => {
        setEditingFilterId(null);
        setCurrentEditFilter({});
    };

    const handleDeleteFilter = async (filterId) => {
        try {
            const response = await delFilter(filterId);
        } catch (err) {
            setError(err.message || 'An error occured while deleting the filter.');
            console.error(err);
        } finally {
            // After deleting, we need to refetch the filters from the main App component.
            // A simple way is to pass down the fetch function, but for now, a page reload
            // can work, or we can manually update the state.
            // For a better UX, we'd pass a refetch function from App.jsx
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        setIsUpdatingFilters(true);
        setError(null);
        try {
            // Ensure the ID is correctly passed to the API function
            const response = await updateFilter(editingFilterId, currentEditFilter);
            // Manually update the state to reflect the change without a full refetch
            setFilters(prevFilters => 
                prevFilters.map(f => 
                    f.id === editingFilterId ? { ...f, ...currentEditFilter } : f
                )
            );
            setEditingFilterId(null);
            setCurrentEditFilter({});
        } catch (err) {
            setError(err.message || 'An error occurred while updating the filter.');
            console.error(err);
        } finally {
            setIsUpdatingFilters(false);
        }
    };

    const handleAddNewFilterSubmit = async (e) => {
        e.preventDefault();
        setIsLoadingFilters(true);
        setError(null);
        try {
            const response = await addFilter(newFilter);
            // Add the new filter to the state
            setFilters(prevFilters => [...prevFilters, response]);
            setNewFilterMode(false);
        } catch (err) {
            setError(err.message || 'An error occurred while adding the filter.');
            console.error(err);
        } finally {
            setIsLoadingFilters(false);
        }
    };

    const handleDeleteClick = (filterId) => {
        setFilterToDelete(filterId);
        setShowConfirmDialog(true);
    };

    if (isLoadingFilters) {
        return (
        <div className="loading-message">
            <p>Loading filters...</p>
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
        <div className="filter-manager-container">

            {/* List of existing filters */}
            <div className="filter-list-section">
            {filters && filters.map(filter => {
                const styles = getStyles(filter.color);
                return (
                    <div key={filter.id} className="filter-item">
                    {editingFilterId === filter.id ? (
                        <form onSubmit={handleUpdateSubmit} className="form-section">
                        <h3 className="form-heading">Editing Filter: <span className="modal-filter-pill" style={styles}>{filter.name}</span></h3>
                        <div className="form-group">
                            <label htmlFor={`edit-name-${filter.id}`} className="form-label">Name</label>
                            <input
                            type="text"
                            id={`edit-name-${filter.id}`}
                            name="name"
                            value={currentEditFilter.name || ''}
                            onChange={handleEditChange}
                            className="form-input"
                            required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor={`edit-color-${filter.id}`} className="form-label">Color</label>
                            <input
                            type="color"
                            id={`edit-color-${filter.id}`}
                            name="color"
                            value={currentEditFilter.color || '#000000'}
                            onChange={handleEditChange}
                            className="form-input color-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor={`edit-icon-${filter.id}`} className="form-label">Icon Name (e.g., PlusCircle, Bolt)</label>
                            <div className="icon-input-group">
                            <input
                                type="text"
                                id={`edit-icon-${filter.id}`}
                                name="icon"
                                value={currentEditFilter.icon || ''}
                                onChange={handleEditChange}
                                placeholder="e.g., ExclamationCircle, Briefcase"
                                className="icon-input-field"
                            />
                            <span className="icon-preview-box">

                            </span>
                            </div>
                        </div>
                        <div className="checkbox-container">
                            <span className="checkbox-label">Admin Only</span>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="admin_only"
                                    className="checkbox-base"
                                    checked={currentEditFilter.admin_only || false}
                                    onChange={handleEditChange}
                                />
                            </label>
                        </div>
                        <div className="form-actions">
                            <button
                            type='button'
                            onClick={() => handleDeleteClick(filter.id)}
                            className='btn-base btn-red'
                            >
                            Delete
                            </button>
                            <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="btn-base btn-secondary"
                            >
                            Cancel
                            </button>
                            <button
                            type="submit"
                            className="btn-base btn-primary"
                            >
                            Save
                            </button>
                        </div>
                        </form>
                    ) : (
                        <div className="filter-item-content">
                        <div className="filter-display-group">
                            <span
                            className="modal-filter-pill"
                            style={styles}
                            title={filter.color}
                            >
                            {filter.name}
                            </span>
                            {filter.admin_only && (
                            <span className="filter-admin-badge">Admin</span>
                            )}
                        </div>
                        <button
                            onClick={() => handleEditClick(filter)}
                            className="btn-base btn-secondary"
                        >
                            <MdEdit /> Edit
                        </button>
                        </div>
                    )}
                    </div>
                )
            })}
            </div>

            {/* Add New Filter Section */}
            <div className="form-container">
            {!newFilterMode ? (
                <button
                onClick={() => {
                    setNewFilterMode(true);
                    setEditingFilterId(null);
                }}
                className="btn-base btn-primary"
                >
                <FaCirclePlus /> Add New Filter
                </button>
            ) : (
                <form onSubmit={handleAddNewFilterSubmit} className="form-section">
                <h3 className="form-heading">Add New Filter</h3>
                <div className="form-group">
                    <label htmlFor="new-name" className="form-label">Name</label>
                    <input
                    type="text"
                    id="new-name"
                    name="name"
                    value={newFilter.name}
                    onChange={handleNewFilterChange}
                    className="form-input new-filter"
                    required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="new-color" className="form-label">Color</label>
                    <input
                    type="color"
                    id="new-color"
                    name="color"
                    value={newFilter.color}
                    onChange={handleNewFilterChange}
                    className="form-input color-input new-filter"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="new-icon" className="form-label">Icon Name (e.g., PlusCircle, Bolt)</label>
                    <div className="icon-input-group">
                    <input
                        type="text"
                        id="new-icon"
                        name="icon"
                        value={newFilter.icon}
                        onChange={handleNewFilterChange}
                        placeholder="e.g., ExclamationCircle, Briefcase"
                        className="icon-input-field new-filter"
                    />
                    <span className="icon-preview-box">

                    </span>
                    </div>
                </div>
                <div className="checkbox-container">
                    <span className="checkbox-label">Admin Only</span>
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            name="admin_only"
                            className="checkbox-base"
                            checked={newFilter.admin_only}
                            onChange={handleNewFilterChange}
                        />
                    </label>
                </div>
                <div className="form-actions">
                    <button
                    type="button"
                    onClick={() => setNewFilterMode(false)}
                    className="btn-base btn-secondary"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    className="btn-base btn-primary"
                    >
                    Add Filter
                    </button>
                </div>
                </form>
            )}
            </div>
            <ConfirmationDialog
                isOpen={showConfirmDialog}
                onClose={() => {
                    setShowConfirmDialog(false);
                    setFilterToDelete('');
                }}
                onConfirm={() => {
                    handleDeleteFilter();
                    setShowConfirmDialog(false);
                }}
                title="Delete Filter"
                message="Are you sure you want to delete this filter? This action cannot be undone."
                confirmText="Delete"
                cancelText="Keep"
                confirmButtonColor="#dc2626"
            />
        </div>
    );
};

export default FilterManager;
