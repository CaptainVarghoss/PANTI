import React, { useState, useEffect } from 'react';
import ConfirmationDialog from './ConfirmDialog';
import { getStyles } from '../helpers/color_helper';
import { useAuth } from '../context/AuthContext';
import { MdDelete } from "react-icons/md";


function FilterManager({filters, setFilters}) {
    const { token, isAdmin } = useAuth();

    const [editableFilters, setEditableFilters] = useState([]);
    const [newFilter, setNewFilter] = useState({ name: '', color: '#000000', icon: '', admin_only: false });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [filterToDelete, setFilterToDelete] = useState('');

    useEffect(() => {
        // Deep copy filters to create a mutable version for editing
        setEditableFilters(JSON.parse(JSON.stringify(filters)));
    }, [filters]);

    const handleInputChange = (id, field, value) => {
        setEditableFilters(prev =>
            prev.map(filter =>
                filter.id === id ? { ...filter, [field]: value } : filter
            )
        );
    };

    const handleNewFilterChange = (field, value) => {
        setNewFilter(prev => ({ ...prev, [field]: value }));
    };

    const handleDiscardChanges = () => {
        setEditableFilters(JSON.parse(JSON.stringify(filters))); // Reset to original
        setMessage(null);
        setError(null);
    };

    const handleSaveChanges = async () => {
        if (!isAdmin) return;
        setIsSaving(true);
        setError(null);
        setMessage(null);

        const updatePromises = editableFilters.map(filter => {
            const originalFilter = filters.find(f => f.id === filter.id);
            if (JSON.stringify(filter) === JSON.stringify(originalFilter)) {
                return Promise.resolve({ ok: true }); // No changes
            }

            return fetch(`/api/filters/${filter.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(filter),
            });
        });

        try {
            const results = await Promise.all(updatePromises);
            const failed = results.filter(res => !res.ok);

            if (failed.length > 0) {
                throw new Error(`${failed.length} filter(s) failed to update.`);
            }

            setMessage('All changes saved successfully!');
            // Notify parent to refetch
            const response = await fetch('/api/filters/', { headers: { 'Authorization': `Bearer ${token}` } });
            const updatedFilters = await response.json();
            setFilters(updatedFilters);

        } catch (err) {
            setError(err.message || 'An error occurred while saving changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNewFilter = async (e) => {
        e.preventDefault();
        if (!isAdmin) return;
        setIsSaving(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch('/api/filters/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(newFilter),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to add filter');
            }

            setMessage('New filter added successfully!');
            setNewFilter({ name: '', color: '#000000', icon: '', admin_only: false }); // Reset form

            // Refetch all filters to update list
            const refetchResponse = await fetch('/api/filters/', { headers: { 'Authorization': `Bearer ${token}` } });
            const updatedFilters = await refetchResponse.json();
            setFilters(updatedFilters);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteFilter = async () => {
        if (!filterToDelete || !isAdmin) return;

        try {
            const response = await fetch(`/api/filters/${filterToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete filter');
            }

            setMessage('Filter deleted successfully!');
            // Refetch to update list
            const refetchResponse = await fetch('/api/filters/', { headers: { 'Authorization': `Bearer ${token}` } });
            const updatedFilters = await refetchResponse.json();
            setFilters(updatedFilters);

        } catch (err) {
            setError(err.message);
        } finally {
            setShowConfirmDialog(false);
            setFilterToDelete('');
        }
    };

    const handleDeleteClick = (filterId) => {
        setFilterToDelete(filterId);
        setShowConfirmDialog(true);
    };

    const hasUnsavedChanges = JSON.stringify(filters) !== JSON.stringify(editableFilters);

    return (
        <>
            <div className="section-container">
                <div className="section-header">
                    <h3>Configured Filters</h3>
                </div>
                {editableFilters.length === 0 ? (
                    <p className="status-text">No filters configured yet.</p>
                ) : (
                    <div className="section-list">
                        {editableFilters.map(filter => (
                            <div key={filter.id} className="section-item">
                                <div className="section-fields">
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input
                                            type="text"
                                            value={filter.name || ''}
                                            onChange={(e) => handleInputChange(filter.id, 'name', e.target.value)}
                                            className="form-input"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Color</label>
                                        <input
                                            type="color"
                                            value={filter.color || '#000000'}
                                            onChange={(e) => handleInputChange(filter.id, 'color', e.target.value)}
                                            className="form-input color-input"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                </div>
                                <div className="section-fields">
                                    <div className="checkbox-container">
                                        <span className="checkbox-label">Admin Only</span>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="checkbox-base"
                                                checked={filter.admin_only}
                                                onChange={(e) => handleInputChange(filter.id, 'admin_only', e.target.checked)}
                                                disabled={!isAdmin}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="section-fields">
                                        <button onClick={() => handleDeleteClick(filter.id)} className="btn-base btn-red icon-button" title="Delete Filter">
                                            <MdDelete size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isAdmin && (
                            <div className="section-footer">
                                {hasUnsavedChanges && (
                                    <button onClick={handleDiscardChanges} className="btn-base btn-orange" disabled={isSaving}>
                                        Discard Changes
                                    </button>
                                )}
                                <button onClick={handleSaveChanges} className="btn-base btn-green" disabled={isSaving || !hasUnsavedChanges}>
                                    {isSaving ? 'Saving...' : 'Apply Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isAdmin && (
                <div className="section-container">
                    <form onSubmit={handleAddNewFilter}>
                        <div className="section-header">
                            <h3>Add New Filter</h3>
                        </div>
                        <div className="section-list">
                            <div className="section-item">
                                <div className="section-fields">
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input
                                            type="text"
                                            value={newFilter.name}
                                            onChange={(e) => handleNewFilterChange('name', e.target.value)}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Color</label>
                                        <input
                                            type="color"
                                            value={newFilter.color}
                                            onChange={(e) => handleNewFilterChange('color', e.target.value)}
                                            className="form-input color-input"
                                        />
                                    </div>
                                </div>
                                <div className="section-fields">
                                    <div className="checkbox-container">
                                        <span className="checkbox-label">Admin Only</span>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="checkbox-base"
                                                checked={newFilter.admin_only}
                                                onChange={(e) => handleNewFilterChange('admin_only', e.target.checked)}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div className="section-fields"></div>
                            </div>
                        </div>
                        
                        
                        <div className="section-footer">
                            <button type="submit" className="btn-base btn-primary" disabled={isSaving}>
                                {isSaving ? 'Adding...' : 'Add Filter'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            <ConfirmationDialog
                isOpen={showConfirmDialog}
                onClose={() => {
                    setShowConfirmDialog(false);
                    setFilterToDelete('');
                }}
                onConfirm={handleDeleteFilter}
                title="Delete Filter"
                message="Are you sure you want to delete this filter? This action cannot be undone."
                confirmText="Delete"
                cancelText="Keep"
                confirmButtonColor="#dc2626"
            />
        </>
    );
};

export default FilterManager;
