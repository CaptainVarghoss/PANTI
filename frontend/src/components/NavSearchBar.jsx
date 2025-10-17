import React, { useState, useEffect, useRef, useCallback} from 'react';
import { IoMdCloseCircle } from "react-icons/io";

/**
 * A search bar component for the navigation bar.
 * It provides a responsive input field and debounces the search term changes
 * before notifying the parent component.
 *
 * @param {object} props - Component props.
 * @param {string} props.searchTerm - The current search term from the parent component.
 * @param {function} props.setSearchTerm - Callback to update the search term in the parent.
 * @param {string} props.sortOrder - The current sort order ('ASC' or 'DESC').
 * @param {function} props.setSortOrder - Callback to update the sort order in the parent.
 */
function NavSearchBar({
    searchTerm,
    setSearchTerm,
    onSearchAndSortChange,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder
}) {
    const [inputValue, setInputValue] = useState(searchTerm);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const debounceDelay = 300; // delay in ms

    // Combined Sort Options (used to render the single list)
    const combinedSortOptions = [
        { key: 'date_created', order: 'desc', label: 'Date: Newest to Oldest' },
        { key: 'date_created', order: 'asc', label: 'Date: Oldest to Newest' },
        { key: 'filename', order: 'asc', label: 'Filename: A to Z' },
        { key: 'filename', order: 'desc', label: 'Filename: Z to A' },
        { key: 'width', order: 'desc', label: 'Width: Largest to Smallest' },
        { key: 'width', order: 'asc', label: 'Width: Smallest to Largest' },
    ];

    // Debounce the update to the parent component's state
    useEffect(() => {
        const handler = setTimeout(() => {
            if (inputValue !== searchTerm) {
                setSearchTerm(inputValue);
            }
        }, debounceDelay);

        // Cleanup function to cancel the timeout if the value changes again
        return () => {
            clearTimeout(handler);
        };
    }, [inputValue, searchTerm, setSearchTerm, debounceDelay]);

    // Sync local state if the parent's searchTerm changes from outside
    useEffect(() => {
        setInputValue(searchTerm);
    }, [searchTerm]);


    // --- Dropdown Logic ---

    // Unified handler to set BOTH sortBy and sortOrder
    const handleSelectCombinedSort = useCallback((key, order) => {
        setSortBy(key);
        setSortOrder(order);
        setIsSortDropdownOpen(false);
    }, [setSortBy, setSortOrder]);

    // Handle outside click to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click is outside both the dropdown and the toggle button
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsSortDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    const handleClear = () => {
        setInputValue('');
        // Update parent immediately for a responsive clear action
        if (searchTerm !== '') {
            setSearchTerm('');
        }
    };

    // Determine the label for the currently selected sort option
    const currentSortLabel = combinedSortOptions.find(opt => 
        opt.key === sortBy && opt.order === sortOrder
    )?.label || 'Sort Options';

    return (
        <div className="navbar-search-wrapper" style={{ position: 'relative' }}>
            {/* Base Search Bar Container */}
            <div className="navbar-search">
                <input
                    type="text"
                    placeholder="Search images..."
                    className="search-bar"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsSortDropdownOpen(false)}
                />
                {inputValue && (
                    <button
                        className="clear-search-button"
                        onClick={handleClear}
                        aria-label="Clear search"
                    >
                        <IoMdCloseCircle size={20} />
                    </button>
                )}
                {/* Sort Order Toggle Button */}
                <button
                    ref={buttonRef}
                    className={`sort-toggle-button ${isSortDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsSortDropdownOpen(prev => !prev)}
                    aria-label="Sort Order"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-down" viewBox="0 0 16 16">
                        <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>
                    </svg>
                </button>
            </div>

            {/* Combined Sort Dropdown Menu (using desired UL/LI structure) */}
            {isSortDropdownOpen && (
                <div ref={dropdownRef} className="sort-dropdown-menu">
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {combinedSortOptions.map((option) => (
                            <li
                                key={`${option.key}-${option.order}`}
                                className={`sort-option ${sortBy === option.key && sortOrder === option.order ? 'selected' : ''}`}
                                onClick={() => handleSelectCombinedSort(option.key, option.order)}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default NavSearchBar;