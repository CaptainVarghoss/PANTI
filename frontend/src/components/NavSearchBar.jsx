import React, { useState, useEffect } from 'react';
import { IoMdCloseCircle } from "react-icons/io";

/**
 * Custom hook for debouncing a value.
 * @param {*} value - The value to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {*} The debounced value.
 */

/**
 * Navigation search bar component with search input and sorting dropdowns.
 * It manages its own state for search term, sort by, and sort order,
 * and notifies its parent via a callback when these values change (debounced for search).
 *
 * @param {object} props - Component props.
 * @param {string} props.initialSearchTerm - Initial value for the search input.
 * @param {string} props.initialSortBy - Initial value for the sort by dropdown.
 * @param {string} props.initialSortOrder - Initial value for the sort order dropdown.
 * @param {function} props.onSearchAndSortChange - Callback function (searchTerm, sortBy, sortOrder)
 * to be called when search/sort parameters change.
 */
function NavSearchBar({ searchTerm, setSearchTerm }) {

    return (
        <div className="navbar-search">
            <input
                type="text"
                placeholder="Search images..."
                className="search-bar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <button
                    className="clear-search-button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                >
                    <IoMdCloseCircle size={20} />
                </button>
            )}
        </div>
    );
}

export default NavSearchBar;