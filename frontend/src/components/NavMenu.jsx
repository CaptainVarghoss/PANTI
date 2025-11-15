import React, { useCallback } from 'react';
import NavMenuDropdown from './NavMenuDropdown';

function NavMenuBar({
    navOpen,
    setNavOpen,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    isSelectMode,
    setIsSelectMode,
    onExitSelectMode
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
        <>
            <div className="navbar-menu-sub">
                <div className="layout-buttons">
                    <button className="grid-button" title="Grid Layout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960">
                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120zm0-80h133v-133H200zm213 0h134v-133H413zm214 0h133v-133H627zM200-413h133v-134H200zm213 0h134v-134H413zm214 0h133v-134H627zM200-627h133v-133H200zm213 0h134v-133H413zm214 0h133v-133H627z"/>
                        </svg>
                    </button>
                    <button className="folders-button" title="Folder Layout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160zm0-80h640v-400H447l-80-80H160zm0 0v-480z"/></svg>
                    </button>
                </div>
                
                <button className="tags-button" title="Manage Tags">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M856-390 570-104q-12 12-27 18t-30 6-30-6-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30-5.5 29.5T856-390M513-160l286-286-353-354H160v286zM260-640q25 0 42.5-17.5T320-700t-17.5-42.5T260-760t-42.5 17.5T200-700t17.5 42.5T260-640m220 160"/></svg>
                    <span>Tags</span>
                </button>
                <button className="folders-button" title="Manage Folders">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160zm0-80h640v-400H447l-80-80H160zm0 0v-480z"/></svg>
                    <span>Folders</span>
                </button>
                <button className="filters-button" title="Manage Filters">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M400-240v-80h160v80zM240-440v-80h480v80zM120-640v-80h720v80z"/></svg>
                    <span>Filters</span>
                </button>
                <NavMenuDropdown
                    buttonClassName="sort-button"
                    buttonContent={
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M120-240v-80h240v80zm0-200v-80h480v80zm0-200v-80h720v80z"/></svg>
                            <span>Sort</span>
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
                <button
                    className={`select-button ${isSelectMode ? 'active' : ''}`}
                    title="Select Multiple"
                    onClick={() => setIsSelectMode(!isSelectMode)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M200-200v80q-33 0-56.5-23.5T120-200zm-80-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm80-160h-80q0-33 23.5-56.5T200-840zm80 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 560h80q0 33-23.5 56.5T760-120zm0-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm0-160v-80q33 0 56.5 23.5T840-760z"/></svg>
                    <span>Select</span>
                </button>
            </div>
        </>
    );

}

export default NavMenuBar;