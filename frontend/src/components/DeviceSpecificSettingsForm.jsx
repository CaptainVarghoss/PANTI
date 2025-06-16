// frontend/src/components/DeviceSpecificSettingsForm.jsx

import React, { useState } from 'react';
import Switch from './Switch';
import Tooltip from './Tooltip';
import useSettingsFormLogic from '../hooks/useSettingsFormLogic'; // Import the new hook

/**
 * Component for managing device-specific user settings.
 * Now refactored to use `useSettingsFormLogic` hook.
 *
 * @param {object} props - Component props.
 * @param {function} props.onBack - Callback to return to the previous settings menu.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 */
function DeviceSpecificSettingsForm({ onBack, onClose }) {
  // Device ID should be managed by AuthContext or a higher-level provider
  // This component will simply read it from localStorage.
  const [deviceId] = useState(() => {
    return localStorage.getItem('deviceId');
  });

  const {
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
    isAuthenticated
  } = useSettingsFormLogic('device', deviceId); // Specify 'device' form type and pass deviceId

  if (loadingLocal) {
    return (
      <div className="settings-panel-content">
        <p className="settings-loading">Loading device settings...</p>
      </div>
    );
  }

  if (!isAuthenticated || !deviceId) {
      return (
          <div className="settings-panel-content">
              <button onClick={onBack} className="settings-back-button">
                  ← Back to Settings Menu
              </button>
              <p className="settings-message error">{error || "Access Denied: You must be logged in and have a device ID to view and edit device-specific settings."}</p>
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

      <h3 className="settings-section-title">Your Device Settings (ID: {deviceId ? deviceId.substring(0, 8) + '...' : 'N/A'})</h3>

      {message && <p className="settings-message success">{message}</p>}
      {error && <p className="settings-message error">{error}</p>}

      <div className="global-settings-list"> {/* Reusing this class for general styling */}
        {Object.entries(groupedSettings).map(([groupName, settingsInGroup]) => (
          <div key={groupName} className="settings-group">
            <h4 className="settings-group-title">{groupName}</h4>
            {settingsInGroup.map((setting) => (
              <div key={setting.id} className="global-setting-item">
                {(() => {
                  const commonProps = {
                    label: setting.display_name || setting.name.replace(/_/g, ' '),
                    disabled: setting.admin_only, // Will always be false as admin_only settings are filtered out
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
                          <label htmlFor={`device-${setting.name}`} className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </label>
                          <input
                            type="text"
                            pattern="[0-9]*\.?[0-9]*"
                            id={`device-${setting.name}`}
                            value={numberInputStates[setting.name] || ''}
                            onChange={handleNumberInputChange(setting.name)}
                            onBlur={handleNumberInputBlur(setting.name)}
                            className="settings-input"
                            disabled={commonProps.disabled}
                          />
                        </>
                      );
                    case 'custom_sidebar_switches':
                      return (
                        <div className="sidebar-switch-group">
                          <span className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </span>
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
                          <label htmlFor={`device-${setting.name}`} className="settings-label">
                            {commonProps.label}
                            {commonProps.description && (
                              <Tooltip content={commonProps.description} />
                            )}
                          </label>
                          <input
                            type="text"
                            id={`device-${setting.name}`}
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

export default DeviceSpecificSettingsForm;
