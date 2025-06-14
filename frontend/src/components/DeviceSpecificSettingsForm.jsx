import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Component for editing device-specific settings for the current user and device.
 * For simplicity, this version allows modifying the 'sidebar' setting at the device level.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function DeviceSpecificSettingsForm({ onBack, onClose }) {
  const { user, token, deviceId, settings, fetchSettings } = useAuth();

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Initialize with current effective value from AuthContext, fallback to 'left'
  const [deviceSidebarValue, setDeviceSidebarValue] = useState(settings.sidebar || 'left');

  // Effect to update the form's state when settings change from context
  useEffect(() => {
    // Only update if the specific setting in context has changed
    if (deviceSidebarValue !== (settings.sidebar || 'left')) {
      setDeviceSidebarValue(settings.sidebar || 'left');
    }
  }, [settings.sidebar, deviceSidebarValue]); // Depend on settings.sidebar and local state

  const handleUpdateDeviceSetting = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user || !token || !deviceId) {
      setError("Authentication or device ID missing. Please log in.");
      return;
    }

    try {
      // Endpoint to check for existing device settings for this user/device
      const checkUrl = `/api/devicesettings/?user_id=${user.id}&device_id=${deviceId}&name=sidebar`;
      const checkResponse = await fetch(checkUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
      });

      let existingSidebarSetting = null;
      if (checkResponse.ok) {
          const existingSettingsList = await checkResponse.json();
          // Filter by name again, although backend query already does this if name is included
          existingSidebarSetting = existingSettingsList.find(
              (s) => s.name === 'sidebar' && s.user_id === user.id && s.device_id === deviceId
          );
      } else {
          console.warn("Failed to check for existing device settings:", checkResponse.statusText);
          // Proceed as if no existing setting if check fails
      }

      let apiMethod = 'POST';
      let apiUrl = '/api/devicesettings/';
      let payload = {
        name: 'sidebar',
        user_id: user.id,
        device_id: deviceId,
        value: deviceSidebarValue,
      };

      if (existingSidebarSetting) {
        apiMethod = 'PUT';
        apiUrl = `/api/devicesettings/${existingSidebarSetting.id}`;
        // For PUT, only send fields that are being updated
        payload = { value: deviceSidebarValue }; // No need to send name, user_id, device_id for PUT
      }

      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage('Device sidebar setting updated successfully!');
        // Re-fetch all settings to update the context with the new tiered value
        await fetchSettings();
      } else {
        const errorData = await response.json();
        setError(`Failed to update setting: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating device setting:', err);
      setError('Network error or failed to update setting.');
    }
  };

  return (
    <div className="settings-sub-form-container"> {/* Use a new class for sub-forms */}
      <button onClick={onBack} className="settings-back-button">
        ← Back to Settings Menu
      </button>

      <h3 className="settings-section-title">Device Specific Settings</h3>

      {/* Display current effective settings for context */}
      <h4 className="settings-subsection-title">Currently Applied Sidebar Setting:</h4>
      <p className="settings-current-value">{settings.sidebar || 'Not set (falls back to global)'}</p>

      <form onSubmit={handleUpdateDeviceSetting} className="settings-edit-form">
        <label htmlFor="deviceSidebar" className="settings-label">
          Set Sidebar Position for This Device:
        </label>
        <select
          id="deviceSidebar"
          value={deviceSidebarValue}
          onChange={(e) => setDeviceSidebarValue(e.target.value)}
          className="settings-input"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="both">Both</option>
          <option value="">(Reset to User/Global)</option> {/* Option to clear device setting */}
        </select>
        <button type="submit" className="settings-submit-button">
          Update Device Sidebar
        </button>
      </form>

      {message && <p className="settings-message success">{message}</p>}
      {error && <p className="settings-message error">{error}</p>}

      <button onClick={onClose} className="settings-close-button">
        Close Sidebar
      </button>
    </div>
  );
}

export default DeviceSpecificSettingsForm;