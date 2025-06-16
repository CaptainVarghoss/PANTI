import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Tooltip from './Tooltip'; // Assuming you'll create a Tooltip component

/**
 * Component for editing device-specific settings for the current user and device.
 * For simplicity, this version allows modifying the 'sidebar' setting at the device level.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function DeviceSpecificSettingsForm({ onBack, onClose }) {
  const { user, token, deviceId, settings, rawSettingsList, fetchSettings, loading: authLoading, isAuthenticated } = useAuth(); // NEW: rawSettingsList
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deviceSidebarValue, setDeviceSidebarValue] = useState(settings.sidebar || 'left');
  const [loadingLocal, setLoadingLocal] = useState(true); // Local loading for this component's data fetch

  // Find the global sidebar setting's metadata
  const sidebarMetadata = rawSettingsList.find(s => s.name === 'sidebar');

  // Effect to update the form's state when settings change from context
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      // Fetch the specific device setting for 'sidebar'
      const fetchDeviceSidebarSetting = async () => {
        setLoadingLocal(true);
        setError('');
        try {
          const response = await fetch(`/api/devicesettings/?user_id=${user.id}&device_id=${deviceId}&name=sidebar`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
          });

          if (response.ok) {
            const existingSettingsList = await response.json();
            const existingSidebarSetting = existingSettingsList.find(
                (s) => s.name === 'sidebar' && s.user_id === user.id && s.device_id === deviceId
            );
            // If a device-specific value exists, use it. Otherwise, fallback to the current effective value from context.
            setDeviceSidebarValue(existingSidebarSetting?.value || (settings.sidebar || 'left'));
          } else {
            console.warn("Failed to check for existing device settings:", response.statusText);
            // If fetching existing fails, still use the current effective value from context
            setDeviceSidebarValue(settings.sidebar || 'left');
          }
        } catch (err) {
          console.error('Error fetching device sidebar setting:', err);
          setError('Failed to load device-specific sidebar setting.');
          setDeviceSidebarValue(settings.sidebar || 'left'); // Fallback to current effective
        } finally {
          setLoadingLocal(false);
        }
      };

      fetchDeviceSidebarSetting();
    } else if (!authLoading && !isAuthenticated) {
        setLoadingLocal(false);
        setError("User not authenticated.");
    }
  }, [user, token, deviceId, settings.sidebar, authLoading, isAuthenticated]);


  const handleUpdateDeviceSetting = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user || !token || !deviceId) {
      setError("Authentication or device ID missing. Please log in.");
      return;
    }

    // Check if the setting is admin_only from its global metadata
    if (sidebarMetadata && sidebarMetadata.admin_only && !user.admin) {
        setError(`"${sidebarMetadata.display_name}" is an admin-only setting and cannot be overridden at the device level.`);
        return;
    }

    try {
      // First, check if a device setting for 'sidebar' already exists for this user/device
      const checkResponse = await fetch(`/api/devicesettings/?user_id=${user.id}&device_id=${deviceId}&name=sidebar`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
      });

      let existingSidebarSetting = null;
      if (checkResponse.ok) {
          const existingSettingsList = await checkResponse.json();
          existingSidebarSetting = existingSettingsList.find(
              (s) => s.name === 'sidebar' && s.user_id === user.id && s.device_id === deviceId
          );
      } else {
          console.warn("Failed to check for existing device settings (pre-update):", checkResponse.statusText);
      }

      let apiMethod = 'POST';
      let apiUrl = '/api/devicesettings/';
      let payload = {
        name: 'sidebar',
        user_id: user.id,
        device_id: deviceId,
        value: deviceSidebarValue,
      };

      // If value is empty, attempt to delete if existing, otherwise no action needed
      if (deviceSidebarValue === '') {
        if (existingSidebarSetting) {
          apiMethod = 'DELETE';
          apiUrl = `/api/devicesettings/${existingSidebarSetting.id}`;
          payload = null;
        } else {
          setMessage('Device sidebar setting already cleared.');
          await fetchSettings(); // Re-fetch to ensure context is up-to-date
          return;
        }
      } else if (existingSidebarSetting) {
        apiMethod = 'PUT';
        apiUrl = `/api/devicesettings/${existingSidebarSetting.id}`;
        payload = { value: deviceSidebarValue };
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
        setMessage('Device sidebar setting updated successfully!');
        await fetchSettings(); // Re-fetch all settings to update the context with the new tiered value
      } else {
        const errorData = await response.json();
        setError(`Failed to update setting: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating device setting:', err);
      setError('Network error or failed to update setting.');
    }
  };

  if (authLoading || loadingLocal) {
    return (
      <div className="settings-sub-form-container">
        <p className="settings-loading">Loading device settings...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
        <div className="settings-sub-form-container">
            <button onClick={onBack} className="settings-back-button">
                ← Back to Settings Menu
            </button>
            <p className="settings-message error">User not authenticated. Please log in to manage device settings.</p>
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

      <h3 className="settings-section-title">Device Specific Settings</h3>

      {/* Display current effective settings for context */}
      <h4 className="settings-subsection-title">Currently Applied Sidebar Setting:</h4>
      <p className="settings-current-value">{settings.sidebar || 'Not set (falls back to global)'}</p>

      <form onSubmit={handleUpdateDeviceSetting} className="settings-edit-form">
        <label htmlFor="deviceSidebar" className="settings-label">
          {sidebarMetadata?.display_name || 'Set Sidebar Position for This Device'}:
          {sidebarMetadata?.description && (
            <Tooltip content={sidebarMetadata.description} />
          )}
        </label>
        <select
          id="deviceSidebar"
          value={deviceSidebarValue}
          onChange={(e) => setDeviceSidebarValue(e.target.value)}
          className="settings-input"
          disabled={sidebarMetadata?.admin_only && !user.admin} // Disable if admin_only and current user is not admin
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="both">Both</option>
          <option value="">(Reset to User/Global)</option> {/* Option to clear device setting */}
        </select>
        <button
            type="submit"
            className="settings-submit-button"
            disabled={sidebarMetadata?.admin_only && !user.admin} // Disable button if admin_only
        >
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
