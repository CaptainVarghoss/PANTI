import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import TagCluster from './TagCluster';

/**
 * Manages image paths, allowing all users to view, and admins to add, edit, and delete.
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous menu.
 */
function ImagePathsManagement({ onBack }) {
  const { token, isAdmin, isAuthenticated } = useAuth();
  const [imagePaths, setImagePaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // State for new/edited path form
  const [editingPath, setEditingPath] = useState(null); // null for add, object for edit
  const [currentPath, setCurrentPath] = useState('');
  const [currentShortName, setCurrentShortName] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const [currentAdminOnly, setCurrentAdminOnly] = useState(true); // State for admin_only switch
  const [currentIgnore, setCurrentIgnore] = useState(false); // State for ignore switch
  const [currentTagIds, setCurrentTagIds] = useState(new Set());

  const fetchImagePaths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/imagepaths/', { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setImagePaths(data);
    } catch (err) {
      console.error('Error fetching image paths:', err);
      setError('Failed to load image paths.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchImagePaths();
  }, [fetchImagePaths]);

  const handleShowAddForm = () => {
    setEditingPath(null);
    setCurrentPath('');
    setCurrentShortName('');
    setCurrentDescription('');
    setCurrentAdminOnly(true);
    setCurrentIgnore(false);
    setMessage(null);
    setError(null);
  };

  const handleShowEditForm = (path) => {
    setEditingPath(path);
    setCurrentPath(path.path);
    setCurrentShortName(path.short_name || '');
    setCurrentDescription(path.description || '');
    setCurrentAdminOnly(path.admin_only);
    setCurrentIgnore(path.ignore);
    setCurrentTagIds(new Set(path.tags.map(t => t.id)));
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!isAdmin) {
      setError("You must be an admin to add or edit image paths.");
      return;
    }
    if (!token) {
        setError("Authentication token missing. Please log in.");
        return;
    }

    // Base payload for new path creation
    let payload = {
      path: currentPath,
      short_name: currentShortName === '' ? null : currentShortName,
      description: currentDescription,
      ignore: currentIgnore, // Include ignore field
      admin_only: currentAdminOnly, // Include admin_only field
      tag_ids: Array.from(currentTagIds),
      basepath: false, // These are typically not changed via UI
      built_in: false, // These are typically not changed via UI
      parent: null, // These are typically not changed via UI
    };

    let apiMethod = 'POST';
    let apiUrl = '/api/imagepaths/';

    if (editingPath) {
      apiMethod = 'PUT';
      apiUrl = `/api/imagepaths/${editingPath.id}`;

      // For PUT, only send changed fields
      const updatePayload = {};
      if (currentPath !== editingPath.path) updatePayload.path = currentPath;
      if (currentShortName !== (editingPath.short_name || '')) updatePayload.short_name = currentShortName === '' ? null : currentShortName;
      if (currentDescription !== (editingPath.description || '')) updatePayload.description = currentDescription;
      if (currentAdminOnly !== editingPath.admin_only) updatePayload.admin_only = currentAdminOnly;
      if (currentIgnore !== editingPath.ignore) updatePayload.ignore = currentIgnore;
      updatePayload.tag_ids = Array.from(currentTagIds);

      payload = updatePayload;
    }

    try {
      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage(`Image path ${editingPath ? 'updated' : 'added'} successfully!`);
        handleShowAddForm(); // Reset form to "add new" mode
        fetchImagePaths();
      } else {
        const errorData = await response.json();
        setError(`Failed to ${editingPath ? 'update' : 'add'} path: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error submitting image path:', err);
      setError('Network error or failed to submit image path.');
    }
  };

  const handleDelete = async (pathId) => {
    if (!isAdmin) {
      setError("You must be an admin to delete image paths.");
      return;
    }
    if (!token) {
        setError("Authentication token missing. Please log in.");
        return;
    }
    if (!window.confirm('Are you sure you want to delete this image path? This cannot be undone.')) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/imagepaths/${pathId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage('Image path deleted successfully!');
        fetchImagePaths();
      } else {
        const errorData = await response.json();
        setError(`Failed to delete path: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting image path:', err);
      setError('Network error or failed to delete image path.');
    }
  };

  const handleManualScan = async () => {
    setMessage(null);
    setError(null);
    setIsScanning(true);

    if (!isAdmin) {
      setError("You must be an admin to trigger a manual scan.");
      setIsScanning(false);
      return;
    }
    if (!token) {
        setError("Authentication token missing. Please log in.");
        setIsScanning(false);
        return;
    }

    try {
      const response = await fetch('/api/scan-files/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`Scan initiated: ${result.message}`);
      } else {
        const errorData = await response.json();
        setError(`Failed to initiate scan: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error triggering scan:', err);
      setError('Network error or failed to trigger scan.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <div className="section-container">
        <div className="section-header">
            <h3>Configured Folder Paths</h3>
        </div>
        {loading ? (
          <p>Loading folder paths...</p>
        ) : imagePaths.length === 0 ? (
          <p className="status-text">No folder paths configured yet.</p>
        ) : (
          <ul className="paths-list">
            {imagePaths.map((path) => (
              <li key={path.id} className="path-item">
                <div className="path-details">
                  <span className="path-name">
                    {path.short_name}
                  </span>
                  {isAdmin && (
                  <div className="path-actions">
                    <button
                      onClick={() => handleShowEditForm(path)}
                      className="btn-base btn-secondary btn-small"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(path.id)}
                      className="btn-base btn-red btn-small"
                    >
                      Delete
                    </button>
                  </div>
                )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAuthenticated && isAdmin && (
        <>
          <div className="section-container form-section">
            <form onSubmit={handleSubmit}>
              <h3>{editingPath ? 'Edit Folder Path' : 'Add New Folder Path'}</h3>
              <div>
                <label htmlFor="path" className="settings-label">
                  Full Path:
                </label>
                <input
                  type="text"
                  id="path"
                  value={currentPath}
                  onChange={(e) => setCurrentPath(e.target.value)}
                  className="form-input"
                  required
                  disabled={editingPath && (editingPath.basepath || editingPath.built_in)}
                />
              </div>
              <div>
                <label htmlFor="shortName" className="settings-label">
                  Short Name (for menu display, optional, must be unique):
                </label>
                <input
                  type="text"
                  id="shortName"
                  value={currentShortName}
                  onChange={(e) => setCurrentShortName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="settings-label">
                  Description (optional):
                </label>
                <textarea
                  id="description"
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  rows="3"
                  className="form-input"
                ></textarea>
              </div>
              <div className="checkbox-container">
                  <span className="checkbox-label">
                      Admin Only
                  </span>
                  <label className="checkbox-label">
                      <input
                          type="checkbox"
                          className="checkbox-base"
                          checked={currentAdminOnly}
                          onChange={() => setCurrentAdminOnly(!currentAdminOnly)}
                          disabled={!isAdmin}
                      />
                  </label>
              </div>
              <div className="checkbox-container">
                  <span className="checkbox-label">
                      Ignore Path
                  </span>
                  <label className="checkbox-label">
                      <input
                          type="checkbox"
                          className="checkbox-base"
                          checked={currentIgnore}
                          onChange={() => setCurrentIgnore(!currentIgnore)}
                          disabled={!isAdmin}
                      />
                  </label>
              </div>
              
              {/* Tag Cluster for editing tags on a path */}
              {editingPath && (
                <TagCluster
                  activeTagIds={currentTagIds}
                  onTagToggle={(tag) => {
                    const tagId = tag.id;
                    const newTagIds = new Set(currentTagIds);
                    if (newTagIds.has(tagId)) newTagIds.delete(tagId); // Use tagId here
                    else newTagIds.add(tagId);
                    setCurrentTagIds(newTagIds);
                  }}
                  canEdit={isAdmin}
                />
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleShowAddForm}
                  className="btn-base btn-secondary"
                >
                  {editingPath ? 'Cancel Edit' : 'Clear'}
                </button>
                <button
                  type="submit"
                  className="btn-base btn-primary"
                >
                  {editingPath ? 'Update Path' : 'Add Path'}
                </button>
              </div>
            </form>
          </div>
          <div className="section-container">
            <button
                  onClick={handleManualScan}
                  className="btn-base btn-yellow"
                  disabled={isScanning || !isAdmin}>
                  {isScanning ? 'Scanning...' : 'Run Manual Scan'}
              </button>
          </div>
        </>
       )}      
    </>
  );
}

export default ImagePathsManagement;