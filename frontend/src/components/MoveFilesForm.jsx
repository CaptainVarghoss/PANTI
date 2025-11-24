import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth to get the token

const MoveFilesForm = ({ filesToMove, onMoveSuccess, onClose }) => {
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { token } = useAuth(); // Get token from auth context

    useEffect(() => {
        // Fetch available folders when the component mounts
        const fetchFolders = async () => {
            try {
                const response = await fetch('/api/folders/', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch folders: ${response.statusText}`);
                }
                const responseData = await response.json();
                setFolders(responseData.folders);
            } catch (err) {
                setError('Failed to load folders.');
                console.error(err);
            }
        };

        fetchFolders();
    }, [token]); // Add token as a dependency

    const handleMoveConfirm = async () => {
        if (!selectedFolder) {
            setError('Please select a destination folder.');
            return;
        }
        if (!filesToMove || filesToMove.length === 0) {
            setError('No files selected to move.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/images/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    imageIds: filesToMove,
                    destinationPath: selectedFolder,
                }),
            });

            if (onMoveSuccess) onMoveSuccess();
            if (onClose) onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred during the move.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-primary)' }}>
                Move Selected Files
            </h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '1rem' }}>
                Select a destination folder to move the {filesToMove.length} selected item(s).
            </p>

            <div className="folder-list-container">
                {folders.length > 0 ? (
                    <ul className="folder-list">
                        {folders.map((folder) => (
                            <li
                                key={folder.path}
                                className={`folder-list-item ${selectedFolder === folder.path ? 'active' : ''}`}
                                onClick={() => setSelectedFolder(folder.path)}
                            >
                                {folder.path}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No destination folders available.</p>
                )}
            </div>

            {error && <p style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>{error}</p>}

            <div className="modal-footer">
                <button className="btn-base btn-orange" onClick={onClose} disabled={isLoading}>Cancel</button>
                <button className="btn-base btn-green" onClick={handleMoveConfirm} disabled={isLoading || !selectedFolder}>{isLoading ? 'Moving...' : 'Move'}</button>
            </div>
        </>
    );
};

export default MoveFilesForm;