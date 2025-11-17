import React, { useState, useEffect } from 'react';
import ImageGrid from './ImageGrid';
import ConfirmationDialog from './ConfirmDialog';
import SelectionToolbar from './SelectionToolbar';
import { useAuth } from '../context/AuthContext';

/**
 * A dedicated view for managing trashed (soft-deleted) images.
 * It displays a grid of deleted items and provides options to
 * restore them or empty the trash permanently.
 */
function TrashView({
    webSocketMessage,
    setTrashCount,
    setCurrentView,
    isSelectMode,
    setIsSelectMode,
    selectedImages,
    setSelectedImages
}) {
    const { token, isAdmin } = useAuth();
    const [images, setImages] = useState([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [sortBy, setSortBy] = useState('date_created');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filters] = useState([]); // Use state to create a stable empty array reference

    const handleBulkAction = async (action) => {
        const imageIds = Array.from(selectedImages);
        if (imageIds.length === 0) return;

        let endpoint = '';
        let confirmMessage = '';

        if (action === 'restore') {
            endpoint = '/api/trash/restore';
            confirmMessage = `Are you sure you want to restore ${imageIds.length} image(s)?`;
        } else if (action === 'delete_permanent') {
            endpoint = '/api/trash/delete-permanent';
            confirmMessage = `Are you sure you want to PERMANENTLY delete ${imageIds.length} image(s)? This action cannot be undone.`;
        }

        if (!window.confirm(confirmMessage)) return;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(imageIds),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to ${action} images.`);
            }

            // Optimistically remove from view and update counts
            setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
            setSelectedImages(new Set());
            setIsSelectMode(false);

        } catch (error) {
            console.error(`Error during bulk ${action}:`, error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleSelectAll = () => {
        setSelectedImages(new Set(images.map(img => img.id)));
    };

    const handleEmptyTrash = async () => {
        console.log("Attempting to empty trash...");
        try {
            const response = await fetch('/api/trash/empty', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to empty trash');
            }

            // On success, clear the images from the view and update counts
            setImages([]);
            setTrashCount(0);
            setCurrentView('grid'); // Go back to the main grid
            alert('Trash has been emptied successfully.');

        } catch (error) {
            console.error("Error emptying trash:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setShowConfirmDialog(false);
        }
    };

    const handleConfirmEmptyTrash = () => {
        setShowConfirmDialog(true);
    };

    return (
        <div className="trash-view-container">
            <div className="trash-view-header">
                <h1>Trash</h1>
                <p>Images here are marked for deletion. You can restore them or empty the trash to permanently delete them.</p>
                {isAdmin && (
                    <button 
                        className="empty-trash-button" 
                        onClick={handleConfirmEmptyTrash}
                        disabled={images.length === 0}
                    >
                        Empty Trash
                    </button>
                )}
            </div>

            {isSelectMode && (
                <SelectionToolbar
                    selectedCount={selectedImages.size}
                    onClearSelection={() => setSelectedImages(new Set())}
                    onSelectAll={handleSelectAll}
                    onExit={() => setIsSelectMode(false)}
                    // Custom actions for Trash view
                    customActions={[
                        { label: 'Restore Selected', handler: () => handleBulkAction('restore'), danger: false },
                        { label: 'Delete Selected Permanently', handler: () => handleBulkAction('delete_permanent'), danger: true },
                    ]}
                />
            )}

            <ImageGrid
                images={images}
                setImages={setImages}
                searchTerm={""} // Always empty for trash view
                sortBy={sortBy}
                sortOrder={sortOrder}
                filters={filters} // Pass stable empty array
                webSocketMessage={webSocketMessage}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
                selectedImages={selectedImages}
                setSelectedImages={setSelectedImages}
                // Pass trash_only=true to fetch deleted items
                trash_only={true}
                // Overwrite context menu items for trash view
                contextMenuItems={[
                    { label: "Restore", action: "restore" },
                    { label: "Delete Permanently", action: "delete_permanent" },
                ]}
            />

            <ConfirmationDialog
                isOpen={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={handleEmptyTrash}
                title="Permanently Empty Trash?"
                message={`Are you sure you want to permanently delete all ${images.length} items in the trash? This action cannot be undone.`}
                confirmText="Empty Trash"
                cancelText="Cancel"
                confirmButtonColor="#dc2626" // Red for destructive action
            />
        </div>
    );
}

export default TrashView;