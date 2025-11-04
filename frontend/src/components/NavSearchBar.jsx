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
    const debounceDelay = 300; // delay in ms

    

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

    const handleClear = () => {
        setInputValue('');
        // Update parent immediately for a responsive clear action
        if (searchTerm !== '') {
            setSearchTerm('');
        }
    };

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
            </div>
        </div>
    );
}

export default NavSearchBar;