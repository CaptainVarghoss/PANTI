import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Component for managing global application settings.
 * This component is only accessible to admin users.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function GlobalSettingsForm({ onBack, onClose }) {
  const { user, token, isAdmin, fetchSettings } = useAuth();
  const [globalSettings, setGlobalSettings] = useState([]); // Stores list of global setting objects
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchGlobalSettings = async () => {
    if (!isAdmin) {
      setError("You are not authorized to view global settings.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch ALL global settings (this endpoint requires admin privileges)
      const response = await fetch('/api/global-settings/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGlobalSettings(data);
      } else {
        setError(`Failed to fetch global settings: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching global settings:', err);
      setError('Network error while fetching global settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalSettings();
  }, [isAdmin, token]); // Re-fetch if admin status or token changes

  const handleUpdateGlobalSetting = async (settingId, name, value) => {
    setMessage('');
    setError('');

    if (!isAdmin) {
      setError("You are not authorized to update global settings.");
      return;
    }

    try {
      const response = await fetch(`/api/settings/${settingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, value }),
      });

      if (response.ok) {
        setMessage(`Global setting '${name}' updated successfully!`);
        await fetchGlobalSettings(); // Re-fetch to update local state
        await fetchSettings(); // Re-fetch global context settings to reflect changes
      } else {
        const errorData = await response.json();
        setError(`Failed to update global setting: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating global setting:', err);
      setError('Network error or failed to update global setting.');
    }
  };

  if (loading) {
    return (
      <div className="settings-sub-form-container">
        <p className="settings-loading">Loading global settings...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="settings-sub-form-container">
        <button onClick={onBack} className="settings-back-button">
          ← Back to Settings Menu
        </button>
        <p className="settings-message error">Access Denied: Only administrators can view and edit global settings.</p>
        <button onClick={onClose} className="settings-close-button">
            Close Sidebar
        </button>
      </div>
    );
  }

  return (
    <div className="settings-sub-form-container">
      <button onClick={onBack} className="settings-back-button">
        ← Back to Settings Menu
      </button>

      <h3 className="settings-section-title">Global Server Settings (Admin Only)</h3>

      {message && <p className="settings-message success">{message}</p>}
      {error && <p className="settings-message error">{error}</p>}

      <div className="global-settings-list">
        {globalSettings.map((setting) => (
          <div key={setting.id} className="global-setting-item">
            <label htmlFor={`global-${setting.name}`} className="settings-label">
              {setting.name} ({setting.admin_only ? 'Admin-Only' : 'User-Editable'}):
            </label>
            <input
              type="text"
              id={`global-${setting.name}`}
              value={setting.value}
              onChange={(e) => {
                // Optimistic update for UI responsiveness
                const newSettings = globalSettings.map(s =>
                  s.id === setting.id ? { ...s, value: e.target.value } : s
                );
                setGlobalSettings(newSettings);
              }}
              onBlur={(e) => handleUpdateGlobalSetting(setting.id, setting.name, e.target.value)}
              className="settings-input"
            />
          </div>
        ))}
      </div>

      <button onClick={onClose} className="settings-close-button">
        Close Sidebar
      </button>
    </div>
  );
}

export default GlobalSettingsForm;