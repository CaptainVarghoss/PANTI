import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ImagePathsManagement from './ImagePathsManagement';
import FilterManager from './FilterManager';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm';
import GlobalSettingsForm from './GlobalSettingsForm';

/**
 * A unified settings component that uses tabs to organize different settings panels.
 *
 * @param {object} props - Component props.
 * @param {Array} props.filters - The list of filters.
 * @param {function} props.setFilters - Function to update filters.
 * @param {function} props.onLogout - Function to handle user logout.
 */
function Settings({ filters, setFilters, onLogout }) {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('device');

    const renderContent = () => {
        switch (activeTab) {
            case 'paths':
                return <ImagePathsManagement />;
            case 'filters':
                return <FilterManager filters={filters} setFilters={setFilters} />;
            case 'device':
                return <DeviceSpecificSettingsForm />;
            case 'global':
                return isAdmin ? <GlobalSettingsForm /> : null;
            default:
                return <ImagePathsManagement />;
        }
    };

    return (
        <section className="modal-body" id="settings">
            <div className="section-container modal-header">
                <div className="tab-container">
                    <button className={`tab-item ${activeTab === 'device' ? 'active' : ''}`} onClick={() => setActiveTab('device')}>Device</button>
                    {isAdmin && (
                        <>
                            <button className={`tab-item ${activeTab === 'paths' ? 'active' : ''}`} onClick={() => setActiveTab('paths')}>Folders</button>
                            <button className={`tab-item ${activeTab === 'filters' ? 'active' : ''}`} onClick={() => setActiveTab('filters')}>Filters</button>
                            <button className={`tab-item ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>Global</button>
                        </>
                    )}
                </div>
            </div>

            <div className="settings-tab-content">
                {renderContent()}
            </div>

            <div className="section-container">
                <button onClick={onLogout} className="btn-base btn-red settings-logout-button">Logout</button>
            </div>
        </section>
    );
}

export default Settings;