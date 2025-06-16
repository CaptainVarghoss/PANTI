import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Tooltip from './Tooltip'; // Assuming you'll create a Tooltip component

/**
 * Component for editing user-specific settings.
 * Allows users to set their own preferences that override global defaults.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function UserSettingsForm({ onBack, onClose }) {
  const { user, token, isAuthenticated, loading: authLoading, rawSettingsList, fetchSettings } = useAuth(); // NEW: rawSettingsList
  
  const [userSettings, setUserSettings] = useState({}); // Stores user's current settings
  const [loadingLocal, setLoadingLocal] = useState(true); // Local loading for this component's data fetch
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Individual states for user-editable settings
  const [themeValue, setThemeValue] = useState('');

  // Find metadata for relevant settings
  const themeMetadata = rawSettingsList.find(s => s.name === 'theme');

  const fetchUserSettings = useCallback(async () => {
    if (authLoading || !user || !token) {
      if (!authLoading) {
        setError("User not authenticated.");
        setLoadingLocal(false);
      }
      return;
    }
    setLoadingLocal(true);
    setError('');
    try {
      const response = await fetch(`/api/usersettings/?user_id=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const settingsMap = data.reduce((acc, setting) => {
          acc[setting.name] = setting;
          return acc;
        }, {});
        setUserSettings(settingsMap);
        
        // Initialize form fields with fetched data
        setThemeValue(settingsMap.theme?.value || '');
      } else {
        setError(`Failed to fetch user settings: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching user settings:', err);
      setError('Network error while fetching user settings.');
    } finally {
      setLoadingLocal(false);
    }
  }, [user, token, authLoading]); // Dependencies for useCallback

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchUserSettings();
    } else if (!authLoading && !isAuthenticated) {
      setLoadingLocal(false);
      setError("User not authenticated.");
      setUserSettings({});
      setThemeValue('');
    }
  }, [isAuthenticated, authLoading, fetchUserSettings]); // Re-fetch if auth status changes

  const handleUpdateUserSetting = async (settingName, value) => {
    setMessage('');
    setError('');

    if (!user || !token) {
      setError("User not authenticated. Please log in.");
      return;
    }

    // Find the global setting metadata to check admin_only status
    const globalSettingMetadata = rawSettingsList.find(s => s.name === settingName);
    if (globalSettingMetadata && globalSettingMetadata.admin_only) {
        setError(`"${globalSettingMetadata.display_name || settingName}" is an admin-only setting and cannot be overridden by users.`);
        return;
    }

    try {
      let apiMethod = 'POST';
      let apiUrl = '/api/usersettings/';
      let payload = {
        name: settingName,
        user_id: user.id,
        value: value,
      };

      const existingSetting = userSettings[settingName];

      if (value === '' && existingSetting) { // User wants to clear the setting
          apiMethod = 'DELETE';
          apiUrl = `/api/usersettings/${existingSetting.id}`;
          payload = null; // No body for DELETE
      } else if (existingSetting) { // Update existing setting
        apiMethod = 'PUT';
        apiUrl = `/api/usersettings/${existingSetting.id}`;
        payload = { value: value }; // Only send value for PUT
      }
      // If value is empty and no existing setting, do nothing (no create)

      if (value === '' && !existingSetting) {
          setMessage(`'${settingName}' setting already cleared.`);
          await fetchSettings(); // Re-fetch to ensure context is up-to-date
          return;
      }


      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: payload ? JSON.stringify(payload) : null,
      });

      if (response.ok) {
        setMessage(`User setting '${globalSettingMetadata?.display_name || settingName}' updated successfully!`);
        await fetchUserSettings(); // Re-fetch to update local state
        await fetchSettings(); // Re-fetch global context settings to reflect changes
      } else {
        const errorData = await response.json();
        setError(`Failed to update user setting: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating user setting:', err);
      setError('Network error or failed to update user setting.');
    }
  };

  if (authLoading || loadingLocal) {
    return (
      <div className="settings-sub-form-container">
        <p className="settings-loading">Loading user settings...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
        <div className="settings-sub-form-container">
            <button onClick={onBack} className="settings-back-button">
                ← Back to Settings Menu
            </button>
            <p className="settings-message error">User not authenticated. Please log in to manage user settings.</p>
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

      <h3 className="settings-section-title">User Specific Settings</h3>

      {message && <p className="settings-message success">{message}</p>}
      {error && <p className="settings-message error">{error}</p>}

      <h4 className="settings-subsection-title">Appearance:</h4> {/* Example Group */}
      <div className="settings-item-group"> {/* New container for grouped settings */}
        {themeMetadata && ( // Ensure metadata exists before rendering
          <div className="settings-edit-form-item"> {/* Individual setting item */}
            <label htmlFor="userTheme" className="settings-label">
              {themeMetadata.display_name}:
              {themeMetadata.description && (
                <Tooltip content={themeMetadata.description} />
              )}
            </label>
            <select
              id="userTheme"
              value={themeValue}
              onChange={(e) => {
                setThemeValue(e.target.value);
                handleUpdateUserSetting('theme', e.target.value); // Immediate update
              }}
              className="settings-input"
              disabled={themeMetadata.admin_only && !user.admin} // Disable if admin_only (though theme is not)
            >
              <option value="default">Default</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="">(Reset to Global)</option>
            </select>
          </div>
        )}
      </div>

      <button onClick={onClose} className="settings-close-button">
        Close Sidebar
      </button>
    </div>
  );
}

export default UserSettingsForm;