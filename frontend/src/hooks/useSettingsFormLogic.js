import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * A custom React hook to encapsulate the common logic for settings forms
 * (Global and Device-Specific settings).
 * Handles fetching, state management for various input types, and updating settings.
 *
 * @param {string} formType - 'global' or 'device'. Determines API endpoints and logic.
 * @param {string} [deviceId] - Required if formType is 'device'. The unique ID of the device.
 * @returns {object} An object containing states and handlers needed by the settings forms.
 */
function useSettingsFormLogic(formType, deviceId = null, useDeviceSettings) {
  const { user, token, isAdmin, isAuthenticated, loading: authLoading, fetchSettings, settings } = useAuth();

  const [settingsList, setSettingsList] = useState([]); // List of full setting objects (Global or Device-accessible)
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // This state was missing. It tracks the user's choice to override global settings with device-specific ones.
  const [useDeviceSettingsOverrideEnabled, setUseDeviceSettingsOverrideEnabled] = useState(useDeviceSettings);

  // States for individual boolean/custom switches, dynamically updated
  const [switchStates, setSwitchStates] = useState({});
  const [textInputStates, setTextInputStates] = useState({});
  const [numberInputStates, setNumberInputStates] = useState({});

  // Helper to convert string 'True'/'False' to boolean
  const parseBooleanSetting = useCallback((value) => value?.toLowerCase() === 'true', []);
  // Helper to convert string to number
  const parseNumberSetting = useCallback((value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '' : num;
  }, []);

  // Sync local state if the prop changes
  useEffect(() => {
    setUseDeviceSettingsOverrideEnabled(useDeviceSettings);
  }, [useDeviceSettings]);

  // Main fetch function, dynamic based on formType
  const fetchCurrentSettings = useCallback(async () => {
    setLoadingLocal(true);
    setError('');

    let endpoint = '';
    let headers = { 'Authorization': `Bearer ${token}` };

    if (!isAuthenticated || !user || !token) {
        setLoadingLocal(false);
        setError("User not authenticated.");
        return;
    }

    if (formType === 'global') {
      if (!isAdmin) {
        setError("Access Denied: Only administrators can view global settings.");
        setLoadingLocal(false);
        return;
      }
      endpoint = '/api/settings/';
    } else if (formType === 'device') {
      if (!deviceId) {
        setError("Device ID is missing for device settings.");
        setLoadingLocal(false);
        return;
      }
      // For device settings, we fetch the tiered settings which include global,
      // and device overrides if 'use_device_settings' is true.
      if (useDeviceSettings) {
        endpoint = `/api/settings/?device_id=${deviceId}`;
        // NO console.log('Is it here?')
      } else {
        endpoint = `/api/settings/`; // Request only global settings
      }
    } else {
      setError("Invalid form type provided.");
      setLoadingLocal(false);
      return;
    }

    try {
      const response = await fetch(endpoint, { headers });
      if (response.ok) {
        const rawData = await response.json();

        // For the 'device' formType, filter out admin-only settings
        // Note: 'use_device_settings' is no longer expected from backend for client-side toggle
        const dataToProcess = formType === 'device' ? rawData.filter(setting => !setting.admin_only) : rawData;
        setSettingsList(dataToProcess);

        const initialSwitchStates = {};
        const initialTextInputStates = {};
        const initialNumberInputStates = {};

        // Populate initial states based on the values in rawData
        dataToProcess.forEach(setting => {
          const value = setting.value;
          switch (setting.input_type) {
            case 'switch':
              initialSwitchStates[setting.name] = parseBooleanSetting(value);
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
        const errorData = await response.json();
        setError(`Failed to fetch settings: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error(`useSettingsFormLogic (${formType}): Network error while fetching settings:`, err);
      setError('Network error while fetching settings.');
    } finally {
      setLoadingLocal(false);
    }
  }, [formType, user, token, settings, isAdmin, isAuthenticated, deviceId, authLoading, parseBooleanSetting, parseNumberSetting]);


  useEffect(() => {
    // Determine when to fetch based on formType and auth status
    const shouldFetch = !authLoading && isAuthenticated && (formType !== 'device' || deviceId);

    if (shouldFetch) {
      fetchCurrentSettings();
    } else if (!authLoading && !shouldFetch) {
      // Clear state if not authorized or missing deviceId for device form
      setLoadingLocal(false);
      setSettingsList([]);
      setSwitchStates({});
      setTextInputStates({});
      setNumberInputStates({});
      setError(""); // Clear error to avoid showing old errors if unauthenticated
      if (!isAuthenticated) {
        setError("User not authenticated.");
      } else if (formType === 'device' && !deviceId) {
        setError("Device ID is missing. Cannot load device-specific settings.");
      } else if (formType === 'global' && !isAdmin) {
        setError("Access Denied: Only administrators can view global settings.");
      }
    }
  }, [isAuthenticated, isAdmin, authLoading, deviceId, formType, fetchCurrentSettings]);


  // Main update function, dynamic based on formType
  const handleUpdateSetting = useCallback(async (settingName, valueToSave) => {
    setMessage('');
    setError('');

    if (!isAuthenticated || !user || !token || (formType === 'device' && !deviceId)) {
      setError("Authorization failed for update.");
      console.warn(`useSettingsFormLogic (${formType}): Unauthorized attempt to update setting.`);
      return;
    }

    let actualValueToSave = valueToSave;
    let apiEndpoint = '';
    let apiMethod = 'PUT'; // Default method for updates
    let requestBody = {};

    const settingMetadata = settingsList.find(s => s.name === settingName);
    if (!settingMetadata) {
        setError(`Setting '${settingName}' metadata not found. Cannot update.`);
        console.error(`useSettingsFormLogic (${formType}): Setting metadata not found for ${settingName}.`);
        return;
    }

    // Convert boolean/number to string for backend if necessary
    if (settingMetadata.input_type === 'switch' && typeof valueToSave === 'boolean') {
      actualValueToSave = valueToSave ? 'True' : 'False';
    } else if (settingMetadata.input_type === 'number' && typeof valueToSave === 'number') {
      actualValueToSave = String(valueToSave);
    }

    // Determine API endpoint and payload based on formType
    if (formType === 'global') {
        if (!isAdmin) {
            setError(`"${settingMetadata.display_name}" is an admin-only setting and you are not authorized to change it.`);
            console.warn(`useSettingsFormLogic (${formType}): Attempted to change global setting ${settingName} by non-admin.`);
            return;
        }
        apiEndpoint = `/api/settings/${settingMetadata.id}`; // Update global setting by ID
        requestBody = { name: settingName, value: actualValueToSave };
    } else if (formType === 'device') {
        // Only allow updates if device settings are enabled
        if (!useDeviceSettings) {
            setError("Device-specific settings are disabled. Please enable the toggle to make changes.");
            console.warn("Attempted to update device settings when the override toggle is off.");
            return;
        }
        if (settingMetadata.admin_only) {
            setError(`"${settingMetadata.display_name}" is an admin-only setting and cannot be overridden by device.`);
            return;
        }
        // For device settings, check if it exists, then PUT/POST
        const existingDeviceSettingResponse = await fetch(`/api/devicesettings/?device_id=${deviceId}&name=${settingName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const existingDeviceSettingData = await existingDeviceSettingResponse.json();

        if (existingDeviceSettingData && existingDeviceSettingData.length > 0) {
            apiEndpoint = `/api/devicesettings/${existingDeviceSettingData[0].id}`;
            requestBody = { value: actualValueToSave };
            // apiMethod remains 'PUT'
        } else {
            apiEndpoint = '/api/devicesettings/';
            apiMethod = 'POST'; // Set to POST for new creation
            requestBody = { user_id: user.id, device_id: deviceId, name: settingName, value: actualValueToSave };
        }
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: apiMethod,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setMessage(`Setting '${settingMetadata.display_name}' updated successfully!`);
        console.log(`useSettingsFormLogic (${formType}): Successfully updated ${settingName}.`);
        await fetchCurrentSettings(); // Re-fetch to update local state and reflect changes
        await fetchSettings(token); // Also refresh the AuthContext settings

      } else {
        const errorData = await response.json();
        setError(`Failed to update setting: ${errorData.detail || response.statusText}`);
        console.error(`useSettingsFormLogic (${formType}): Failed to update ${settingName}:`, errorData);
        console.error(`useSettingsFormLogic (${formType}): Response Status: ${response.status}, Body:`, errorData);
      }
    } catch (err) {
      console.error(`useSettingsFormLogic (${formType}): Network error or failed to update setting:`, err);
      setError('Network error or failed to update setting.');
    }
  }, [formType, user, token, isAdmin, isAuthenticated, deviceId, settingsList, fetchCurrentSettings, fetchSettings, useDeviceSettings]);


  // Toggle handler for the 'use_device_settings' global setting
  const handleUseDeviceSettingsOverrideToggle = useCallback(async () => {
    setMessage('');
    setError('');

    const newValue = !useDeviceSettingsOverrideEnabled;
    localStorage.setItem('use_device_settings_override', newValue ? 'true' : 'false');
    setUseDeviceSettingsOverrideEnabled(newValue);
    setMessage(`'Use Device Specific Settings' set to ${newValue ? 'Enabled' : 'Disabled'}.`);

    await fetchSettings(token);
    await fetchCurrentSettings();
  }, [useDeviceSettingsOverrideEnabled, fetchCurrentSettings, fetchSettings, token]);

  // Generic toggle handler for single boolean switches
  const handleBooleanToggle = useCallback((settingName) => () => {
    setSwitchStates(prev => {
      const currentValue = prev[settingName];
      const newValue = !currentValue;
      const newState = { ...prev, [settingName]: newValue };
      handleUpdateSetting(settingName, newValue);
      return newState;
    });
  }, [handleUpdateSetting]);

  // Generic change handler for text inputs
  const handleTextInputChange = useCallback((settingName) => (e) => {
    setTextInputStates(prev => ({ ...prev, [settingName]: e.target.value }));
  }, []);

  // Generic blur handler for text inputs (saves on blur)
  const handleTextInputBlur = useCallback((settingName) => (e) => {
    handleUpdateSetting(settingName, e.target.value);
  }, [handleUpdateSetting]);

  // Generic change handler for number inputs
  const handleNumberInputChange = useCallback((settingName) => (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNumberInputStates(prev => ({ ...prev, [settingName]: value }));
    }
  }, []);

  // Generic blur handler for number inputs (saves on blur)
  const handleNumberInputBlur = useCallback((settingName) => (e) => {
      const numValue = parseFloat(e.target.value);
      if (!isNaN(numValue)) {
          handleUpdateSetting(settingName, numValue);
      } else if (e.target.value === '') {
          handleUpdateSetting(settingName, '');
      } else {
          setError(`Invalid number for ${settingName}. Please enter a valid number.`);
      }
  }, [handleUpdateSetting]);

  // Group settings by their 'group' property for rendering
  const groupedSettings = useMemo(() => {
    const groups = {};
    settingsList.forEach(setting => {
      const groupName = setting.group || 'Other';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(setting);
    });
    return groups;
  }, [settingsList]);

  return {
    loadingLocal,
    message,
    error,
    groupedSettings,
    switchStates,
    textInputStates,
    numberInputStates,
    useDeviceSettings: useDeviceSettingsOverrideEnabled, // Export the new state
    handleBooleanToggle,
    handleTextInputChange,
    handleTextInputBlur,
    handleNumberInputChange,
    handleNumberInputBlur,
    handleUseDeviceSettingsOverrideToggle, // Export the handler
    isAuthenticated, // Export for conditional rendering in components
    isAdmin // Export for conditional rendering in components
  };
}

export default useSettingsFormLogic;
