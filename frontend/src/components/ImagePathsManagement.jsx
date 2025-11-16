import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Switch from './Switch';
import Tooltip from './Tooltip';

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
  const [showForm, setShowForm] = useState(false);
  const [editingPath, setEditingPath] = useState(null); // null for add, object for edit
  const [currentPath, setCurrentPath] = useState('');
  const [currentShortName, setCurrentShortName] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const [currentAdminOnly, setCurrentAdminOnly] = useState(true); // State for admin_only switch
  const [currentIgnore, setCurrentIgnore] = useState(false); // State for ignore switch

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
    setShowForm(true);
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
    setShowForm(true);
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
        setShowForm(false);
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
    <div className="settings-container">

      {showForm && isAuthenticated && isAdmin && (
        <div className="settings-group">
          <h4 className="settings-group-title">
            {editingPath ? 'Edit Folder Path' : 'Add New Folder Path'}
          </h4>
          <form onSubmit={handleSubmit} className="path-form">
            <div>
              <label htmlFor="path" className="settings-label">
                Full Path:
              </label>
              <input
                type="text"
                id="path"
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                className="settings-input"
                required
                disabled={editingPath && (editingPath.basepath || editingPath.built_in)} // Disable path edit for base/built-in paths
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
                className="settings-input"
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
                rows="2"
                className="settings-input form-textarea"
              ></textarea>
            </div>
            {/* Admin Only Switch */}
            <div className="sidebar-switch-group">
                <Switch
                    isOn={currentAdminOnly}
                    handleToggle={() => setCurrentAdminOnly(!currentAdminOnly)}
                    label="Admin Only"
                    description="If enabled, only admin users can access content from this path. Default for new paths is ON."
                    disabled={!isAdmin} // Only admin can change; built-in paths are fixed
                />
            </div>
            {/* Ignore Switch */}
            <div className="sidebar-switch-group">
                <Switch
                    isOn={currentIgnore}
                    handleToggle={() => setCurrentIgnore(!currentIgnore)}
                    label="Ignore Path"
                    description="If enabled, this path will be ignored during scans and its content will not be indexed."
                    disabled={!isAdmin} // Only admin can change; built-in paths are fixed
                />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="settings-cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-submit-button"
              >
                {editingPath ? 'Update Path' : 'Add Path'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="settings-group">
        {loading ? (
          <p className="status-text">Loading folder paths...</p>
        ) : imagePaths.length === 0 ? (
          <p className="status-text">No folder paths configured yet.</p>
        ) : (
          <ul className="paths-list">
            {imagePaths.map((path) => (
              <li key={path.id} className="path-item">
                <div className="path-details">
                  <span className="path-name">
                    {path.short_name}
                    <Tooltip content={path.path} position='top' />
                  </span>
                  {isAdmin && (
                  <div className="path-actions">
                    <button
                      onClick={() => handleShowEditForm(path)}
                      className="edit-button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(path.id)}
                      className="delete-button"
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
      {/* Conditional rendering for the "Add New Folder Path" button outside the form */}
      {!showForm && isAuthenticated && isAdmin && (
        <div className="settings-group">
            <button
            onClick={handleShowAddForm}
            className="add-path-button"
            >
            Add New Folder Path
            </button>
            <button
            onClick={handleManualScan}
            className="manual-scan-button"
            >
            Run Manual Folder Scan
            </button>
        </div>
      )}
    </div>
  );
}

export default ImagePathsManagement;