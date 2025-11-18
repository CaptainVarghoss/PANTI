import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from 'react-icons/md';

/**
 * A flexible component to display and manage tags in a cluster or word-cloud style.
 *
 * @param {object} props
 * @param {Set<number>} props.activeTagIds - A Set of tag IDs that are currently active/selected.
 * @param {function(number): void} props.onTagToggle - Callback function executed when a tag is clicked. It receives the tag ID.
 * @param {boolean} [props.canEdit=true] - Whether to show the 'Add' and 'Edit' controls.
 * @param {boolean} [props.showUntagged=true] - Whether to display tags that are not in the active set.
 * @param {function(): void} [props.onTagsUpdated] - An optional callback to notify the parent that the master tag list has changed (e.g., after adding/editing a tag).
 */
function TagCluster({ activeTagIds, onTagToggle, canEdit = true, showUntagged = true, onTagsUpdated }) {
  const { token } = useAuth();
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null); // null for new, or tag object for editing

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/tags/', { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Sort tags alphabetically for consistent display
      data.sort((a, b) => a.name.localeCompare(b.name));
      setAllTags(data);
    } catch (e) {
      setError('Failed to load tags.');
      console.error('Error fetching tags:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleOpenEditorForNew = () => {
    setEditingTag(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditorForEdit = (tag, event) => {
    event.stopPropagation(); // Prevent the toggle from firing
    setEditingTag(tag);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingTag(null);
  };

  const handleSaveSuccess = () => {
    // Refetch all tags to get the updated list
    fetchTags();
    // Notify parent component if needed
    if (onTagsUpdated) {
      onTagsUpdated();
    }
    handleEditorClose();
  };

  if (loading) {
    return <div className="tag-cluster-message">Loading tags...</div>;
  }

  if (error) {
    return <div className="tag-cluster-message error">{error}</div>;
  }

  return (
    <>
      <div className="tag-cluster-container">
        <div className="tag-cluster-header">
          <h4 className="tag-cluster-title">Tags</h4>
          {canEdit && (
            <div className="tag-cluster-controls">
              <button onClick={handleOpenEditorForNew} className="tag-cluster-add-button" title="Add new tag">
                +
              </button>
            </div>
          )}
        </div>
        <div className="tag-cluster">
          {allTags.length > 0 ? (
            allTags.filter(tag => showUntagged || activeTagIds.has(tag.id)).map(tag => (
              <Tag
                key={tag.id}
                tag={tag}
                onClick={() => onTagToggle(tag)}
                isActive={activeTagIds.has(tag.id)}
                canEdit={canEdit}
                onEdit={(e) => handleOpenEditorForEdit(tag, e)}
              />
            ))
          ) : (
            <p>No tags found.</p>
          )}
        </div>
      </div>

      {isEditorOpen && (
        <TagEditorModal
          tag={editingTag}
          onClose={handleEditorClose}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </>
  );
}

/**
 * Renders a single tag pill.
 *
 * @param {object} props
 * @param {object} props.tag - The tag object { id, name, color, text_color }.
 * @param {function} props.onClick - Function to call when the tag is clicked.
 * @param {boolean} props.isActive - Whether the tag is currently active.
 * @param {boolean} props.canEdit - Whether the edit button should be shown on hover.
 * @param {function} props.onEdit - Function to call when the edit button is clicked.
 */
function Tag({ tag, onClick, isActive, canEdit, onEdit }) {
  const tagStyle = { // Use a default style but allow active state to override border
    border: `2px solid ${isActive ? 'var(--color-tertiary)' : tag.color}`,
  };

  return (
    <div
      className={`tag-pill ${isActive ? 'active' : ''}`}
      style={tagStyle}
      onClick={onClick}
      title={tag.name}
    >
      <span className="tag-name">{tag.name}</span>
      {canEdit && (
        <button
          className="tag-edit-button"
          onClick={onEdit}
          title={`Edit "${tag.name}" tag`}
        >
          <MdEdit size={14} />
        </button>
      )}
    </div>
  );
}
/**
 * A simple modal for creating or editing a tag.
 */
function TagEditorModal({ tag, onClose, onSaveSuccess }) {
    const { token } = useAuth();
    const [name, setName] = useState(tag ? tag.name : '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const isNew = !tag;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const url = isNew ? '/api/tags/' : `/api/tags/${tag.id}`;
        const method = isNew ? 'POST' : 'PUT';

        const payload = {
            name,
            // Sending default values for other fields if they are not part of the form
            ...(tag ? {
                icon: tag.icon,
                admin_only: tag.admin_only,
                built_in: tag.built_in
            } : {
                icon: 'tag',
                admin_only: false,
                built_in: false
            })
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save tag.');
            }

            onSaveSuccess();

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isNew || !window.confirm(`Are you sure you want to permanently delete the "${tag.name}" tag? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        setError(null);

        try {
            const response = await fetch(`/api/tags/${tag.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete tag.');
            }

            onSaveSuccess(); // Re-uses the same success path to refetch and close

        } catch (err) {
            setError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="tag-editor-modal-overlay" onClick={onClose}>
            <div className="tag-editor-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="tag-editor-title">{isNew ? 'Create New Tag' : 'Edit Tag'}</h3>
                <div className="tag-editor-form">
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <div className="form-actions">
                        {!isNew && (
                            <button type="button" onClick={handleDelete} className="button-delete" disabled={isSaving || isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} disabled={isSaving || isDeleting}>Cancel</button>
                        <button type="button" onClick={handleSubmit} disabled={isSaving || isDeleting}>{isSaving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TagCluster;