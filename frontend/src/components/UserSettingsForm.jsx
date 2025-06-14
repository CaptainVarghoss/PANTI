import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Component for editing user-specific settings.
 * Allows users to set their own preferences that override global defaults.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function UserSettingsForm({ onBack, onClose }) {
  const { user, token, fetchSettings } = useAuth();
  const [userSettings, setUserSettings] = useState({}); // Stores user's current settings
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Example: user-specific theme preference
  const [themeValue, setThemeValue] = useState('');

  const fetchUserSettings = async () => {
    if (!user || !token) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/usersettings/?user_id=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Convert array to a map for easy lookup
        const settingsMap = data.reduce((acc, setting) => {
          acc[setting.name] = setting; // Store the full setting object to get ID for PUT/DELETE
          return acc;
        }, {});
        setUserSettings(settingsMap);
        // Initialize form fields with fetched data
        setThemeValue(settingsMap.theme?.value || ''); // Assuming 'theme' is a user-editable setting
      } else {
        setError(`Failed to fetch user settings: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching user settings:', err);
      setError('Network error while fetching user settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSettings();
  }, [user, token]); // Re-fetch if user or token changes

  const handleUpdateUserSetting = async (settingName, value) => {
    setMessage('');
    setError('');

    if (!user || !token) {
      setError("User not authenticated.");
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
          return; // No action needed if already cleared
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
        setMessage(`User setting '${settingName}' updated successfully!`);
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

  if (loading) {
    return (
      <div className="settings-sub-form-container">
        <p className="settings-loading">Loading user settings...</p>
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

      <h4 className="settings-subsection-title">Set Your Preferred Theme:</h4>
      <form onSubmit={(e) => { e.preventDefault(); handleUpdateUserSetting('theme', themeValue); }} className="settings-edit-form">
        <label htmlFor="userTheme" className="settings-label">
          Theme:
        </label>
        <select
          id="userTheme"
          value={themeValue}
          onChange={(e) => setThemeValue(e.target.value)}
          className="settings-input"
        >
          <option value="default">Default</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="">(Reset to Global)</option> {/* Option to clear user setting */}
        </select>
        <button type="submit" className="settings-submit-button">
          Update Theme
        </button>
      </form>

      {/* You can add more user-specific settings here */}

      <button onClick={onClose} className="settings-close-button">
        Close Sidebar
      </button>
    </div>
  );
}

export default UserSettingsForm;