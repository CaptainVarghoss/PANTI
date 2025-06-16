// frontend/src/hooks/useSettingsFormLogic.js

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * A custom React hook to encapsulate the common logic for settings forms
 * (Global, User, and Device-Specific settings).
 * Handles fetching, state management for various input types, and updating settings.
 *
 * @param {string} formType - 'global', 'user', or 'device'. Determines API endpoints and logic.
 * @param {string} [deviceId] - Required if formType is 'device'. The unique ID of the device.
 * @returns {object} An object containing states and handlers needed by the settings forms.
 */
function useSettingsFormLogic(formType, deviceId = null) {
  const { user, token, isAdmin, isAuthenticated, loading: authLoading, fetchSettings } = useAuth();

  const [settingsList, setSettingsList] = useState([]); // List of full setting objects (Global, User-accessible, or Device-accessible)
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  // Helper function to determine sidebar value based on switch states
  const getSidebarValueFromSwitches = useCallback((leftEnabled, rightEnabled) => {
    if (leftEnabled && rightEnabled) {
      return 'both';
    } else if (leftEnabled) {
      return 'left';
    } else if (rightEnabled) {
      return 'right';
    } else {
      return 'left';
    }
  }, []);

  // Main fetch function, dynamic based on formType
  const fetchCurrentSettings = useCallback(async () => {
    console.log(`useSettingsFormLogic (${formType}): fetchCurrentSettings called.`);
    setLoadingLocal(true);
    setError('');

    let endpoint = '';
    let headers = { 'Authorization': `Bearer ${token}` };

    // Determine the API endpoint based on formType
    if (formType === 'global') {
      if (!isAdmin || !user || !token) {
        setError("Access Denied: Only administrators can view global settings.");
        setLoadingLocal(false);
        return;
      }
      endpoint = '/api/global-settings/';
    } else if (formType === 'user') {
      if (!isAuthenticated || !user || !token) {
        setError("User not authenticated to view user settings.");
        setLoadingLocal(false);
        return;
      }
      endpoint = '/api/user-accessible-settings/';
    } else if (formType === 'device') {
      if (!isAuthenticated || !user || !token) {
        setError("User not authenticated to view device settings.");
        setLoadingLocal(false);
        return;
      }
      if (!deviceId) {
        setError("Device ID is missing for device settings.");
        setLoadingLocal(false);
        return;
      }
      endpoint = `/api/user-accessible-settings/?device_id=${deviceId}`;
    } else {
      setError("Invalid form type provided.");
      setLoadingLocal(false);
      return;
    }

    try {
      const response = await fetch(endpoint, { headers });
      if (response.ok) {
        const rawData = await response.json();

        // Filter data based on form type (e.g., user/device forms only show non-admin settings)
        const dataToProcess = formType === 'global' ? rawData : rawData.filter(setting => !setting.admin_only);
        setSettingsList(dataToProcess);

        const initialSwitchStates = {};
        const initialTextInputStates = {};
        const initialNumberInputStates = {};

        dataToProcess.forEach(setting => {
          const value = setting.value;
          switch (setting.input_type) {
            case 'switch':
              initialSwitchStates[setting.name] = parseBooleanSetting(value);
              break;
            case 'custom_sidebar_switches':
              initialSwitchStates['sidebarLeftEnabled'] = (value.toLowerCase() === 'left' || value.toLowerCase() === 'both');
              initialSwitchStates['sidebarRightEnabled'] = (value.toLowerCase() === 'right' || value.toLowerCase() === 'both');
              console.log(`useSettingsFormLogic (${formType}): Initializing sidebar switches. Value: "${value}". Left: ${initialSwitchStates['sidebarLeftEnabled']}, Right: ${initialSwitchStates['sidebarRightEnabled']}`);
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
        
        console.log(`useSettingsFormLogic (${formType}): Initial Switch States after fetch:`, initialSwitchStates);
        setError('');
      } else {
        const errorData = await response.json();
        setError(`Failed to fetch settings: ${errorData.detail || response.statusText}`);
        console.error(`useSettingsFormLogic (${formType}): Failed to fetch settings:`, errorData);
      }
    } catch (err) {
      console.error(`useSettingsFormLogic (${formType}): Network error while fetching settings:`, err);
      setError('Network error while fetching settings.');
    } finally {
      setLoadingLocal(false);
      console.log(`useSettingsFormLogic (${formType}): fetchCurrentSettings finished. Loading state:`, loadingLocal);
    }
  }, [formType, user, token, isAdmin, isAuthenticated, deviceId, authLoading, parseBooleanSetting, parseNumberSetting]);


  useEffect(() => {
    console.log(`useSettingsFormLogic (${formType}): useEffect triggered. Auth Loading:`, authLoading, "Is Authenticated:", isAuthenticated, "Is Admin:", isAdmin, "Device ID:", deviceId);
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
      if (!isAuthenticated) {
        setError("User not authenticated.");
      } else if (formType === 'device' && !deviceId) {
        setError("Device ID is missing. Cannot load device-specific settings.");
      } else if (formType === 'global' && !isAdmin) {
        setError("Access Denied: Only administrators can view global settings.");
      }
      console.log(`useSettingsFormLogic (${formType}): Resetting states due to auth/device status.`);
    }
  }, [isAuthenticated, isAdmin, authLoading, deviceId, formType, fetchCurrentSettings]);


  // Main update function, dynamic based on formType
  const handleUpdateSetting = useCallback(async (settingName, valueToSave) => {
    console.log(`useSettingsFormLogic (${formType}): handleUpdateSetting called for ${settingName} with incoming valueToSave:`, valueToSave);
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
    } else if (settingMetadata.input_type === 'custom_sidebar_switches') {
      // For sidebar, valueToSave is already the combined string ('left', 'right', 'both', '')
      actualValueToSave = valueToSave;
      console.log(`useSettingsFormLogic (${formType}): Sidebar update logic - Using pre-calculated value: "${actualValueToSave}"`);
    }

    // Determine API endpoint and payload based on formType
    if (formType === 'global') {
        if (!isAdmin) {
            setError(`"${settingMetadata.display_name}" is an admin-only setting and you are not authorized to change it.`);
            console.warn(`useSettingsFormLogic (${formType}): Attempted to change global setting ${settingName} by non-admin.`);
            return;
        }
        apiEndpoint = `/api/settings/${settingMetadata.id}`;
        requestBody = { name: settingName, value: actualValueToSave };
    } else if (formType === 'user') {
        if (settingMetadata.admin_only) {
            setError(`"${settingMetadata.display_name}" is an admin-only setting and cannot be overridden by user.`);
            console.warn(`useSettingsFormLogic (${formType}): Attempted to override admin-only setting ${settingName} by user.`);
            return;
        }
        // For user settings, check if it exists, then PUT/POST
        const existingUserSettingResponse = await fetch(`/api/usersettings/?user_id=${user.id}&name=${settingName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const existingUserSettingData = await existingUserSettingResponse.json();

        if (existingUserSettingData && existingUserSettingData.length > 0) {
            apiEndpoint = `/api/usersettings/${existingUserSettingData[0].id}`;
            requestBody = { value: actualValueToSave };
            // apiMethod remains 'PUT'
        } else {
            apiEndpoint = '/api/usersettings/';
            apiMethod = 'POST'; // Set to POST for new creation
            requestBody = { user_id: user.id, name: settingName, value: actualValueToSave };
        }
    } else if (formType === 'device') {
        if (settingMetadata.admin_only) {
            setError(`"${settingMetadata.display_name}" is an admin-only setting and cannot be overridden by device.`);
            console.warn(`useSettingsFormLogic (${formType}): Attempted to override admin-only setting ${settingName} by device.`);
            return;
        }
        // For device settings, check if it exists, then PUT/POST
        const existingDeviceSettingResponse = await fetch(`/api/devicesettings/?user_id=${user.id}&device_id=${deviceId}&name=${settingName}`, {
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

    console.log(`useSettingsFormLogic (${formType}): Making API call - Method: ${apiMethod}, Endpoint: ${apiEndpoint}, Body:`, JSON.stringify(requestBody));

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
        await fetchSettings(); // Also refresh the AuthContext settings
        console.log(`useSettingsFormLogic (${formType}): Update and refresh cycle completed.`);

      } else {
        const errorData = await response.json();
        setError(`Failed to update setting: ${errorData.detail || response.statusText}`);
        console.error(`useSettingsFormLogic (${formType}): Failed to update ${settingName}:`, errorData);
        // Log the full response for more details
        console.error(`useSettingsFormLogic (${formType}): Response Status: ${response.status}, Body:`, errorData);
      }
    } catch (err) {
      console.error(`useSettingsFormLogic (${formType}): Network error or failed to update setting:`, err);
      setError('Network error or failed to update setting.');
    }
  }, [formType, user, token, isAdmin, isAuthenticated, deviceId, settingsList, fetchCurrentSettings, fetchSettings]);


  // Toggle handlers for switches that immediately trigger updates
  const handleToggleLeft = useCallback(() => {
    setSwitchStates(prev => {
      const newLeftState = !prev['sidebarLeftEnabled'];
      const newState = { ...prev, sidebarLeftEnabled: newLeftState };
      const sidebarValueToSend = getSidebarValueFromSwitches(newLeftState, prev['sidebarRightEnabled']);
      handleUpdateSetting('sidebar', sidebarValueToSend);
      return newState;
    });
  }, [getSidebarValueFromSwitches, handleUpdateSetting]);

  const handleToggleRight = useCallback(() => {
    setSwitchStates(prev => {
      const newRightState = !prev['sidebarRightEnabled'];
      const newState = { ...prev, sidebarRightEnabled: newRightState };
      const sidebarValueToSend = getSidebarValueFromSwitches(prev['sidebarLeftEnabled'], newRightState);
      handleUpdateSetting('sidebar', sidebarValueToSend);
      return newState;
    });
  }, [getSidebarValueFromSwitches, handleUpdateSetting]);

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
    handleBooleanToggle,
    handleToggleLeft,
    handleToggleRight,
    handleTextInputChange,
    handleTextInputBlur,
    handleNumberInputChange,
    handleNumberInputBlur,
    isAuthenticated, // Export for conditional rendering in components
    isAdmin // Export for conditional rendering in components
  };
}

export default useSettingsFormLogic;
