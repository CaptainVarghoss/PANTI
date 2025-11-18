import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ImagePathsManagement from './ImagePathsManagement';
import DeviceSpecificSettingsForm from './DeviceSpecificSettingsForm';
import GlobalSettingsForm from './GlobalSettingsForm';
import FilterManager from './FilterManager';

const AccordionItem = ({ title, children, isOpen, onClick }) => (
    <div className="accordion-item">
        <button className={`accordion-title ${isOpen ? 'open' : ''}`} onClick={onClick}>
            <span>{title}</span>
            <span className={`accordion-icon ${isOpen ? 'open' : ''}`}>{'>'}</span>
        </button>
        <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
            <div className="accordion-content-inner">
                {children}
            </div>
        </div>
    </div>
);

/**
 * A modal to display and manage all application settings.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {function} props.onClose - Callback function to close the modal.
 */
function SettingsModal({ isOpen, onClose, filters, setFilters }) {
    const { isAdmin, logout } = useAuth();
    const [openSections, setOpenSections] = useState({});
    const [allAvailableTags, setAllAvailableTags] = useState([]);

    const handleAccordionClick = (sectionName) => {
        setOpenSections(prevOpenSections => ({
            ...prevOpenSections,
            [sectionName]: !prevOpenSections[sectionName]
        }));
    };

    const handleLogout = () => {
        logout();
        onClose();
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="settings-modal-header">
                    <h2 className="settings-modal-title">Settings</h2>
                    <button onClick={onClose} className="settings-modal-close-button" aria-label="Close settings">
                        &times;
                    </button>
                </div>

                <div className="settings-modal-body">
                    <div className="accordion">
                        <AccordionItem title="Manage Folders (Image Paths)" isOpen={!!openSections['folders']} onClick={() => handleAccordionClick('folders')}>
                            <ImagePathsManagement />
                        </AccordionItem>

                        <AccordionItem title="Manage Filters" isOpen={!!openSections['filters']} onClick={() => handleAccordionClick('filters')}>
                            <FilterManager filters={filters} setFilters={setFilters} />
                        </AccordionItem>

                        <AccordionItem title="Device Settings" isOpen={!!openSections['device']} onClick={() => handleAccordionClick('device')}>
                            <DeviceSpecificSettingsForm />
                        </AccordionItem>

                        {isAdmin && (
                            <AccordionItem title="Global Server Settings (Admin)" isOpen={!!openSections['global']} onClick={() => handleAccordionClick('global')}>
                                <GlobalSettingsForm />
                            </AccordionItem>
                        )}
                    </div>
                </div>
                <div className="settings-modal-footer">
                    <button onClick={handleLogout} className="settings-logout-button">Logout</button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
