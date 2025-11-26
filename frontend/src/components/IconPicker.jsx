import React, { useState, useMemo } from 'react';
import * as MdIcons from 'react-icons/md';
import { IoClose } from 'react-icons/io5';

/**
 * A searchable modal component for selecting an icon from the react-icons/md library.
 *
 * @param {object} props
 * @param {function(string): void} props.onSelectIcon - Callback function when an icon is selected. It receives the icon name.
 * @param {function(): void} props.onClose - Callback function to close the picker.
 */
function IconPicker({ onSelectIcon, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');

    // Memoize the list of icon names to avoid re-calculating on every render
    const iconList = useMemo(() => Object.keys(MdIcons), []);

    // Memoize the filtered list of icons based on the search term
    const filteredIcons = useMemo(() => {
        if (!searchTerm) {
            return iconList;
        }
        return iconList.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, iconList]);

    const handleIconClick = (iconName) => {
        onSelectIcon(iconName);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Choose an Icon</h3>
                    <button onClick={onClose} className="btn-base btn-red modal-close-button" title="Close">
                        <IoClose size={24} />
                    </button>
                </div>
                <section className="modal-body" id="settings">
                    <div className="section-container">
                        <div className="icon-picker-search">
                            <input
                                type="text"
                                placeholder="Search for an icon..."
                                className="form-input-base"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="icon-picker-grid">
                            {filteredIcons.length > 0 ? filteredIcons.map(iconName => {
                                const IconComponent = MdIcons[iconName];
                                return (
                                    <button
                                        key={iconName}
                                        className="btn-base icon-picker-item"
                                        onClick={() => handleIconClick(iconName)}
                                        title={iconName}
                                    >
                                        <IconComponent size={28} />
                                    </button>
                                );
                            }) : (
                                <p>No icons found.</p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default IconPicker;