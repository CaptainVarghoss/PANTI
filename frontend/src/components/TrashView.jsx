import React, { useState, useEffect } from 'react';
import ImageGrid from './ImageGrid';
import ConfirmationDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';

/**
 * A dedicated view for managing trashed (soft-deleted) images.
 * It displays a grid of deleted items and provides options to
 * restore them or empty the trash permanently.
 */
function TrashView({
    images,
    setImages,
    webSocketMessage,
    setWebSocketMessage,
    setTrashCount,
    setCurrentView,
    isSelectMode,
    setIsSelectMode,
    selectedImages,
    setSelectedImages
}) {
    const { token, isAdmin } = useAuth();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [sortBy, setSortBy] = useState('date_created');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filters] = useState([]); // Use state to create a stable empty array reference

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
                        className="btn-base empty-trash-button" 
                        onClick={handleConfirmEmptyTrash}
                        disabled={images.length === 0}
                    >
                        Empty Trash
                    </button>
                )}
            </div>

            <ImageGrid
                images={images}
                setImages={setImages}
                searchTerm={""}
                sortBy={sortBy}
                sortOrder={sortOrder}
                filters={filters}
                webSocketMessage={webSocketMessage}
                setWebSocketMessage={setWebSocketMessage}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
                selectedImages={selectedImages}
                setSelectedImages={setSelectedImages}
                trash_only={true}
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