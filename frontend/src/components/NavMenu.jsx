import React, { useCallback } from 'react';
import NavMenuDropdown from './NavMenuDropdown';

function NavMenuBar({
    navOpen,
    setNavOpen,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder
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
            <div className="nav-menu-bar-sub">
                <button className="tags-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M3 2v4.586l7 7L14.586 9l-7-7zM2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586z"/>
                        <path d="M5.5 5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m0 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M1 7.086a1 1 0 0 0 .293.707L8.75 15.25l-.043.043a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 0 7.586V3a1 1 0 0 1 1-1z"/>
                    </svg>
                    Tags
                </button>
                <button className="folders-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160zm0-80h640v-400H447l-80-80H160zm0 0v-480z"/></svg>
                    Folders
                </button>
                <button className="filters-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M400-240v-80h160v80zM240-440v-80h480v80zM120-640v-80h720v80z"/></svg>
                    Filters
                </button>
                <NavMenuDropdown
                    buttonClassName="sort-button"
                    buttonContent={
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z"/><path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z"/></svg>
                            Sort
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
                <button className="select-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M200-200v80q-33 0-56.5-23.5T120-200zm-80-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm80-160h-80q0-33 23.5-56.5T200-840zm80 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 560h80q0 33-23.5 56.5T760-120zm0-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm0-160v-80q33 0 56.5 23.5T840-760z"/></svg>
                    Select
                </button>
                <button className="trash-button"> 
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg>
                </button>
            </div>
        </>
    );

}

export default NavMenuBar;