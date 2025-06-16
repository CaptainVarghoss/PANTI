import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Switch from './Switch';
import Tooltip from './Tooltip'; // NEW: Import Tooltip

/**
 * Component for managing global application settings.
 * This component is only accessible to admin users.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function GlobalSettingsForm({ onBack, onClose }) {
  const { user, token, isAdmin, isAuthenticated, loading: authLoading, fetchSettings } = useAuth();
  const [globalSettings, setGlobalSettings] = useState([]); // List of full setting objects
  const [loadingLocal, setLoadingLocal] = useState(true); // Local loading for this component's data fetch
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // States for individual boolean/custom switches, dynamically updated
  const [switchStates, setSwitchStates] = useState({});
  const [textInputStates, setTextInputStates] = useState({});
  const [numberInputStates, setNumberInputStates] = useState({});

  // Helper to convert string 'True'/'False' to boolean
  const parseBooleanSetting = useCallback((value) => value.toLowerCase() === 'true', []);
  // Helper to convert string to number
  const parseNumberSetting = useCallback((value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '' : num; // Return empty string if invalid, so input is controlled
  }, []);

  const fetchGlobalSettings = useCallback(async () => {
    if (authLoading || !user || !token || !isAdmin) {
      if (!authLoading && (!user || !token)) {
        setError("User not authenticated.");
        setLoadingLocal(false);
      } else if (!authLoading && user && token && !isAdmin) {
        setError("Access Denied: Only administrators can view and edit global settings.");
        setLoadingLocal(false);
      }
      return;
    }

    setLoadingLocal(true);
    setError('');
    try {
      const rawGlobalSettingsResponse = await fetch('/api/global-settings/', {
           headers: { 'Authorization': `Bearer ${token}` },
      });

      if (rawGlobalSettingsResponse.ok) {
          const rawData = await rawGlobalSettingsResponse.json();
          setGlobalSettings(rawData);

          // Initialize all input states based on fetched data
          const initialSwitchStates = {};
          const initialTextInputStates = {};
          const initialNumberInputStates = {};

          rawData.forEach(setting => {
            const value = setting.value; // Keep as string for initial processing

            switch (setting.input_type) {
              case 'switch':
                initialSwitchStates[setting.name] = parseBooleanSetting(value);
                break;
              case 'custom_sidebar_switches':
                initialSwitchStates['sidebarLeftEnabled'] = (value.toLowerCase() === 'left' || value.toLowerCase() === 'both');
                initialSwitchStates['sidebarRightEnabled'] = (value.toLowerCase() === 'right' || value.toLowerCase() === 'both');
                break;
              case 'number':
                initialNumberInputStates[setting.name] = parseNumberSetting(value);
                break;
              case 'text':
              default:
                initialTextInputStates[setting.name] = value;
                break;
            }
          });
          setSwitchStates(initialSwitchStates);
          setTextInputStates(initialTextInputStates);
          setNumberInputStates(initialNumberInputStates);

          setError('');
      } else {
           setError(`Failed to fetch raw global settings: ${rawGlobalSettingsResponse.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching global settings:', err);
      setError('Network error while fetching global settings.');
    } finally {
      setLoadingLocal(false);
    }
  }, [user, token, isAdmin, authLoading, parseBooleanSetting, parseNumberSetting]);


  useEffect(() => {
    // Only fetch settings if the core auth loading is complete AND user is authenticated/admin
    // This prevents trying to fetch before user data is available
    if (!authLoading && (isAuthenticated && isAdmin)) { // Ensure isAdmin for this form
      fetchGlobalSettings();
    } else if (!authLoading && (!isAuthenticated || !isAdmin)) {
      // If auth loading is complete but user is not authenticated or not admin,
      // reset states and show appropriate error.
      setLoadingLocal(false);
      setGlobalSettings([]);
      setSwitchStates({});
      setTextInputStates({});
      setNumberInputStates({});
      if (!isAuthenticated) {
        setError("User not authenticated.");
      } else if (!isAdmin) {
        setError("Access Denied: Only administrators can view and edit global settings.");
      }
    }
  }, [isAuthenticated, isAdmin, authLoading, fetchGlobalSettings]);


  // Helper function to determine sidebar value based on switch states
  const getSidebarValueFromSwitches = (leftEnabled, rightEnabled) => {
    if (leftEnabled && rightEnabled) {
      return 'Both';
    } else if (leftEnabled) {
      return 'Left';
    } else if (rightEnabled) {
      return 'Right';
    } else {
      return 'Left';
    }
  };

  const handleUpdateGlobalSetting = async (settingName, valueToSave, settingId = null) => {
    setMessage('');
    setError('');

    if (!isAdmin || !user || !token) {
      setError("You are not authorized to update global settings. Please log in as an administrator.");
      return;
    }

    let actualValueToSave = valueToSave;
    let targetSettingId = settingId;

    // Find the global setting metadata to get its ID and current admin_only status
    const settingMetadata = globalSettings.find(s => s.name === settingName);
    if (!settingMetadata) {
        setError(`Setting '${settingName}' metadata not found. Cannot update.`);
        return;
    }

    targetSettingId = settingMetadata.id; // Always use the ID from the fetched metadata

    // Frontend validation: prevent non-admins from changing admin_only settings
    if (settingMetadata.admin_only && !isAdmin) {
        setError(`"${settingMetadata.display_name}" is an admin-only setting and cannot be changed.`);
        return;
    }

    // Convert boolean value to string 'True'/'False' for backend
    if (settingMetadata.input_type === 'switch' && typeof valueToSave === 'boolean') {
      actualValueToSave = valueToSave ? 'True' : 'False';
    }
    // Convert number value to string for backend
    if (settingMetadata.input_type === 'number' && typeof valueToSave === 'number') {
        actualValueToSave = String(valueToSave);
    }
    // Special handling for custom_sidebar_switches
    if (settingMetadata.input_type === 'custom_sidebar_switches') {
        actualValueToSave = valueToSave;
    }


    try {
      const response = await fetch(`/api/settings/${targetSettingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: settingName, value: actualValueToSave }),
      });

      if (response.ok) {
        setMessage(`Global setting '${settingMetadata.display_name}' updated successfully!`);
        console.log(`GlobalSettingsForm: Successfully updated ${settingName} (ID: ${actualValueToSave}).`);
        console.log("GlobalSettingsForm: Triggering fetchGlobalSettings to refresh local state.");
        // Re-fetch global settings to update local state (and all switch/input states)
        await fetchGlobalSettings();
        // Also refresh the overall context settings to affect navbar/sidebar display immediately
        await fetchSettings();
      } else {
        const errorData = await response.json();
        setError(`Failed to update global setting: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating global setting:', err);
      setError('Network error or failed to update global setting.');
    }
  };

  // Toggle handlers for switches that immediately trigger updates
  const handleToggleLeft = async () => {
    console.log("GlobalSettingsForm: handleToggleLeft called.");
    const newLeftState = !switchStates['sidebarLeftEnabled'];
    setSwitchStates(prev => {
      const newState = { ...prev, sidebarLeftEnabled: newLeftState };
      console.log("GlobalSettingsForm: Optimistic update - sidebarLeftEnabled:", newLeftState, "Current switchStates:", newState);
      return newState;
    });
    // Use the *new* state for calculation that will be sent to the backend
    // The handleUpdateGlobalSetting needs to be aware of the pending state change.
    // Or, for simplicity and to ensure correct state is used by the next action,
    // we can pass the combined expected values.
    // For now, it relies on switchStates being updated synchronously, which it is.
    const sidebarValue = getSidebarValueFromSwitches(newLeftState, switchStates['sidebarRightEnabled']);
    await handleUpdateGlobalSetting('sidebar', sidebarValue);
  };

  const handleToggleRight = async () => {
    console.log("GlobalSettingsForm: handleToggleRight called.");
    const newRightState = !switchStates['sidebarRightEnabled'];
    setSwitchStates(prev => {
      const newState = { ...prev, sidebarRightEnabled: newRightState };
      console.log("GlobalSettingsForm: Optimistic update - sidebarRightEnabled:", newRightState, "Current switchStates:", newState);
      return newState;
    });
    const sidebarValue = getSidebarValueFromSwitches(switchStates['sidebarLeftEnabled'], newRightState);
    await handleUpdateGlobalSetting('sidebar', sidebarValue);
  };

  // Generic toggle handler for single boolean switches
  const handleBooleanToggle = (settingName) => async () => {
    const currentValue = switchStates[settingName];
    const newValue = !currentValue;
    setSwitchStates(prev => ({ ...prev, [settingName]: newValue })); // Optimistic update
    await handleUpdateGlobalSetting(settingName, newValue);
  };

  // Generic change handler for text inputs
  const handleTextInputChange = (settingName) => (e) => {
    setTextInputStates(prev => ({ ...prev, [settingName]: e.target.value }));
  };

  // Generic blur handler for text inputs (saves on blur)
  const handleTextInputBlur = (settingName) => (e) => {
    handleUpdateGlobalSetting(settingName, e.target.value);
  };

  // Generic change handler for number inputs
  const handleNumberInputChange = (settingName) => (e) => {
    const value = e.target.value;
    // Only allow numbers (and empty string)
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNumberInputStates(prev => ({ ...prev, [settingName]: value }));
    }
  };

  // Generic blur handler for number inputs (saves on blur)
  const handleNumberInputBlur = (settingName) => (e) => {
      const numValue = parseFloat(e.target.value);
      if (!isNaN(numValue)) {
          handleUpdateGlobalSetting(settingName, numValue);
      } else if (e.target.value === '') {
          handleUpdateGlobalSetting(settingName, ''); // Allow clearing number field
      } else {
          setError(`Invalid number for ${settingName}. Please enter a valid number.`);
      }
  };


  // Group settings by their 'group' property
  const groupedSettings = useMemo(() => {
    const groups = {};
    globalSettings.forEach(setting => {
      const groupName = setting.group || 'Other'; // Default group if not specified
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(setting);
    });
    return groups;
  }, [globalSettings]);


  if (authLoading || loadingLocal) {
    return (
      <div className="settings-sub-form-container">
        <p className="settings-loading">Loading global settings...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
      return (
          <div className="settings-sub-form-container">
              <button onClick={onBack} className="settings-back-button">
                  ← Back to Settings Menu
              </button>
              <p className="settings-message error">{error || "Access Denied: You must be an administrator to view and edit global settings."}</p>
              <button onClick={onClose} className="settings-close-button">
                  Close Sidebar
              </button>
          </div>
      );
  }

  return (
    <div className="settings-panel-content">
      <button onClick={onBack} className="settings-back-button">
        ← Back to Settings Menu
      </button>

      <h3 className="settings-section-title">Global Server Settings (Admin Only)</h3>

      {message && <p className="settings-message success">{message}</p>}
      {error && <p className="settings-message error">{error}</p>}

      <div className="global-settings-list">
        {Object.entries(groupedSettings).map(([groupName, settingsInGroup]) => (
          <div key={groupName} className="settings-group">
            <h4 className="settings-group-title">{groupName}</h4>
            {settingsInGroup.map((setting) => (
              <div key={setting.id} className="global-setting-item">
                {/* Conditional rendering based on input_type */}
                {(() => {
                  const commonProps = {
                    label: `${setting.display_name || setting.name.replace(/_/g, ' ')}${setting.admin_only ? ' (Admin-Only)' : ''}`,
                    disabled: setting.admin_only && !isAdmin,
                    description: setting.description,
                  };

                  switch (setting.input_type) {
                    case 'switch':
                      return (
                        <Switch
                          isOn={switchStates[setting.name] || false}
                          handleToggle={handleBooleanToggle(setting.name)}
                          {...commonProps}
                        />
                      );
                    case 'number':
                      return (
                        <>
                          <label htmlFor={`global-${setting.name}`} className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </label>
                          <input
                            type="text" // Use text to allow partial number entry before conversion on blur
                            pattern="[0-9]*\.?[0-9]*" // HTML5 pattern for basic validation
                            id={`global-${setting.name}`}
                            value={numberInputStates[setting.name]}
                            onChange={handleNumberInputChange(setting.name)}
                            onBlur={handleNumberInputBlur(setting.name)}
                            className="settings-input"
                            disabled={commonProps.disabled}
                          />
                        </>
                      );
                    case 'custom_sidebar_switches': // Special handling for sidebar
                      return (
                        <div className="sidebar-switch-group">
                          <p className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </p>
                          <Switch
                            isOn={switchStates['sidebarLeftEnabled'] || false}
                            handleToggle={handleToggleLeft}
                            label="Left Sidebar"
                            disabled={commonProps.disabled}
                          />
                          <Switch
                            isOn={switchStates['sidebarRightEnabled'] || false}
                            handleToggle={handleToggleRight}
                            label="Right Sidebar"
                            disabled={commonProps.disabled}
                          />
                        </div>
                      );
                    case 'text':
                    default:
                      return (
                        <>
                          <label htmlFor={`global-${setting.name}`} className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </label>
                          <input
                            type="text"
                            id={`global-${setting.name}`}
                            value={textInputStates[setting.name] || ''}
                            onChange={handleTextInputChange(setting.name)}
                            onBlur={handleTextInputBlur(setting.name)}
                            className="settings-input"
                            disabled={commonProps.disabled}
                          />
                        </>
                      );
                  }
                })()}
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}

export default GlobalSettingsForm;