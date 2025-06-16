import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm';
import GlobalSettingsForm from './GlobalSettingsForm';

/**
 * SettingsForm component acts as a router/container for different settings views
 * (Device-specific, User-specific, Global).
 * It manages its own internal panel transitions.
 *
 * @param {object} props - Component props.
 * @param {function} props.onClose - Callback to close the parent sidebar.
 * @param {function} props.onBack - Callback to return to the main sidebar menu (from outside this form).
 * @param {'left' | 'right'} props.side - The side of the sidebar this form is rendered in.
 */
function SettingsForm({ onClose, onBack, side }) {
  const { user, settings, isAdmin } = useAuth(); // Get user, settings, isAdmin from AuthContext
  const [currentSubPanel, setCurrentSubPanel] = useState('overview');

  const handleBackToOverview = () => {
    setCurrentSubPanel('overview');
  };

  const getSubPanelClassName = (panelName) => {
    // Determine animation class based on side and current panel
    let slideClass = '';
    if (panelName === currentSubPanel) {
      slideClass = (side === 'left' ? 'panel-slide-in-from-left' : 'panel-slide-in-from-right');
    } else {
      slideClass = (side === 'left' ? 'panel-slide-out-to-left' : 'panel-slide-out-to-right');
    }
    return `settings-sub-panel ${slideClass} ${panelName === currentSubPanel ? 'panel-active' : 'panel-inactive'}`;
  };

  return (
    <div className="settings-form-container">
      {/* Settings Overview Panel */}
      <div className={getSubPanelClassName('overview')}>
        <button onClick={onBack} className="settings-back-button">
          ← Back to Main Menu
        </button>

        <nav className="settings-sub-nav">
          <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSubPanel('device'); }} className="settings-link">
            Device Specific Settings
          </a>
          {isAdmin && (
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSubPanel('global'); }} className="settings-link">
              Global Server Settings (Admin)
            </a>
          )}
        </nav>
      </div>

      {/* Device Specific Settings Panel */}
      <div className={getSubPanelClassName('device')}>
        <DeviceSpecificSettingsForm onBack={handleBackToOverview} onClose={onClose} />
      </div>

      {/* Global Settings Panel */}
      <div className={getSubPanelClassName('global')}>
        <GlobalSettingsForm onBack={handleBackToOverview} onClose={onClose} />
      </div>
    </div>
  );
}

export default SettingsForm;
