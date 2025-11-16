import React from 'react';
import Switch from './Switch';
import Tooltip from './Tooltip';
import useSettingsFormLogic from '../hooks/useSettingsFormLogic'; // Import the new hook

/**
 * Component for managing global application settings.
 * This component is only accessible to admin users.
 * Now refactored to use `useSettingsFormLogic` hook.
 *
 * @param {object} props - Component props.
 */
function GlobalSettingsForm() {
  const {
    loadingLocal,
    message,
    error,
    groupedSettings,
    switchStates,
    textInputStates,
    numberInputStates,
    handleBooleanToggle,
    handleTextInputChange,
    handleTextInputBlur,
    handleNumberInputChange,
    handleNumberInputBlur,
    isAuthenticated,
    isAdmin
  } = useSettingsFormLogic('global'); // Specify 'global' form type

  if (loadingLocal) {
    return (
      <div className="settings-panel-content">
        <p className="settings-loading">Loading global settings...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
      return (
          <div className="settings-panel-content">
              <p className="settings-message error">{error || "Access Denied: You must be an administrator to view and edit global settings."}</p>
          </div>
      );
  }

  return (
    <div className="settings-container">
      {Object.entries(groupedSettings).map(([groupName, settingsInGroup]) => (
        <div key={groupName} className="settings-group">
          <h4 className="settings-group-title">{groupName}</h4>
          {settingsInGroup.map((setting) => (
            <div key={setting.id} className="settings-item">
              {(() => {
                const commonProps = {
                  label: `${setting.display_name || setting.name.replace(/_/g, ' ')}`,
                  disabled: setting.admin_only && !isAdmin, // Global settings might be admin_only
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
                          type="text"
                          pattern="[0-9]*\.?[0-9]*"
                          id={`global-${setting.name}`}
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
  );
}

export default GlobalSettingsForm;