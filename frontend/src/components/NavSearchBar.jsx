import React, { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing a value.
 * @param {*} value - The value to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {*} The debounced value.
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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
function NavSearchBar({ initialSearchTerm, initialSortBy, initialSortOrder, onSearchAndSortChange }) {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [sortBy, setSortBy] = useState(initialSortBy);
    const [sortOrder, setSortOrder] = useState(initialSortOrder);

    const debouncedSearchTerm = useDebounce(searchTerm, 500); // Debounce search input by 500ms

    // Effect to call the parent's callback when debounced search term or sort options change
    useEffect(() => {
        // Only call if the callback exists and is a function
        if (typeof onSearchAndSortChange === 'function') {
            onSearchAndSortChange(debouncedSearchTerm, sortBy, sortOrder);
        }
    }, [debouncedSearchTerm, sortBy, sortOrder, onSearchAndSortChange]);

    return (
        <div className="navbar-search">
            <input
                type="text"
                placeholder="Search images..."
                className="search-bar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="navbar-search-select">
                <select
                    className="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="date_created">Sort by Date</option>
                    <option value="filename">Sort by Filename</option>
                    <option value="checksum">Sort by Checksum</option>
                </select>
            </div>
            <div className="navbar-search-select">
                <select
                    className="sort-order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                </select>
            </div>
        </div>
    );
}

export default NavSearchBar;