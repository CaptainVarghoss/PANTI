import React, { useState } from 'react';
import Switch from './Switch';
import Tooltip from './Tooltip';
import useSettingsFormLogic from '../hooks/useSettingsFormLogic';

/**
 * Component for managing device-specific user settings.
 * It now includes a toggle to switch between applying device-specific overrides
 * or viewing read-only global settings.
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
    useDeviceSettings,
    handleBooleanToggle,
    handleTextInputChange,
    handleTextInputBlur,
    handleNumberInputChange,
    handleNumberInputBlur,
    handleUseDeviceSettingsOverrideToggle,
    isAuthenticated
  } = useSettingsFormLogic('device', deviceId);

  if (loadingLocal) {
    return (
      <div className="settings-panel-content">
        <p className="settings-loading">Loading device settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">

      {/* Toggle for "Use Device Specific Settings" */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="switch-container">
              <span className="switch-label">
                <h4 className="settings-group-title">Use Device Specific Settings -- (ID: {deviceId ? deviceId.substring(0, 8) + '...' : 'N/A'})</h4>
                <Tooltip content="When enabled, these settings will override global defaults for this specific device. When disabled, this device will use global settings." />
              </span>
              <Switch
                isOn={useDeviceSettings}
                handleToggle={handleUseDeviceSettingsOverrideToggle}
                label=""
              />
          </div>
        </div>
      </div>

      <p className="device-settings-info-text">
        {useDeviceSettings
          ? "Device-specific settings are active. Changes made here will override global settings."
          : "Device-specific settings are currently disabled. This device is using global settings (read-only mode). Toggle the switch above to enable editing."}
      </p>

        {Object.entries(groupedSettings).map(([groupName, settingsInGroup]) => (
          <div key={groupName} className="settings-group">
            <h4 className="settings-group-title">{groupName}</h4>
            {settingsInGroup.map((setting) => (
              <div key={setting.id} className="settings-item">
                {(() => {
                  const isDisabled = !useDeviceSettings || setting.admin_only;
                  const commonProps = {
                    label: setting.display_name || setting.name.replace(/_/g, ' '),
                    disabled: isDisabled,
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
  );
}

export default DeviceSpecificSettingsForm;
