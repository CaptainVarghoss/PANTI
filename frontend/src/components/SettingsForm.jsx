import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm'; // Import new sub-form
import UserSettingsForm from './UserSettingsForm';         // Import new sub-form
import GlobalSettingsForm from './GlobalSettingsForm';       // Import new sub-form

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
  const [currentSubPanel, setCurrentSubPanel] = useState('overview'); // 'overview', 'device', 'user', 'global'

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

        <h3 className="settings-section-title">Settings Overview</h3>

        <h4 className="settings-subsection-title">Currently Applied Settings:</h4>
        <ul className="settings-list">
          {Object.entries(settings).map(([key, value]) => (
            <li key={key} className="settings-list-item">
              <strong>{key}:</strong> {String(value)}
            </li>
          ))}
        </ul>

        <h4 className="settings-subsection-title">Manage Settings:</h4>
        <nav className="settings-sub-nav">
          <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSubPanel('device'); }} className="settings-link">
            Device Specific Settings
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSubPanel('user'); }} className="settings-link">
            User Settings ({user?.username})
          </a>
          {isAdmin && (
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSubPanel('global'); }} className="settings-link">
              Global Server Settings (Admin)
            </a>
          )}
        </nav>

        <button onClick={onClose} className="settings-close-button">
          Close Sidebar
        </button>
      </div>

      {/* Device Specific Settings Panel */}
      <div className={getSubPanelClassName('device')}>
        <DeviceSpecificSettingsForm onBack={handleBackToOverview} onClose={onClose} />
      </div>

      {/* User Settings Panel */}
      <div className={getSubPanelClassName('user')}>
        <UserSettingsForm onBack={handleBackToOverview} onClose={onClose} />
      </div>

      {/* Global Settings Panel */}
      <div className={getSubPanelClassName('global')}>
        <GlobalSettingsForm onBack={handleBackToOverview} onClose={onClose} />
      </div>
    </div>
  );
}

export default SettingsForm;
