import React, {useState} from 'react';
import SettingsButton from './SettingsButton';
import NavMenuDropdown from './NavMenuDropdown';

function NavbarMenuButtons({
    side,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
}) {

    // --- Dropdown Logic ---

    // Unified handler to set BOTH sortBy and sortOrder
    const handleSelectCombinedSort = (key, order, setIsOpen) => {
        setSortBy(key);
        setSortOrder(order);
        setIsOpen(false);
    };

    // Combined Sort Options (used to render the single list)
    const combinedSortOptions = [
        { key: 'date_created', order: 'desc', label: 'Date: Newest to Oldest' },
        { key: 'date_created', order: 'asc', label: 'Date: Oldest to Newest' },
        { key: 'filename', order: 'asc', label: 'Filename: A to Z' },
        { key: 'filename', order: 'desc', label: 'Filename: Z to A' },
        { key: 'width', order: 'desc', label: 'Width: Largest to Smallest' },
        { key: 'width', order: 'asc', label: 'Width: Smallest to Largest' },
    ];

    return (
        <div className={`navbar-menu-buttons side-${side}`}>
            <SettingsButton />
            <button className="trash-button" title="View Trash"> 
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120zm400-600H280v520h400zM360-280h80v-360h-80zm160 0h80v-360h-80zM280-720v520z"/></svg>
            </button>
            <NavMenuDropdown
                buttonClassName="adv-search-button"
                buttonContent={
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M400-240v-80h160v80zM240-440v-80h480v80zM120-640v-80h720v80z"/></svg>
                    </>
                }
            >
                {({ setIsOpen }) => (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {combinedSortOptions.map((option) => (
                            <li
                                key={`${option.key}-${option.order}`}
                                className={`sort-option ${sortBy === option.key && sortOrder === option.order ? 'selected' : ''}`}
                                onClick={() => handleSelectCombinedSort(option.key, option.order, setIsOpen)}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                )}
            </NavMenuDropdown>
        </div>
    );
}

export default NavbarMenuButtons;