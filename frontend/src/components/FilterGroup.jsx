import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";
import {getStyles} from '../helpers/color_helper';

function FilterGroup({ searchTerm, setSearchTerm, setSubPanel, activeFilters, setActiveFilters }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const [isLoadingFilters, setIsLoadingFilters] = useState(false);
    const [allAvailableFilters, setAllAvailableFilters] = useState([]);
    const [isUpdatingFilters, setIsUpdatingFilters] = useState(false);
    const [filterUpdateMessage, setFilterUpdateMessage] = useState('');
    const [filterUpdateError, setFilterUpdateError] = useState('');

    const canModifyFilters = isAdmin;

    // Effect to fetch all available tags
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchAllFilters = async () => {
            setIsLoadingFilters(true);
            try {
                const response = await fetch('/api/filters/', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setAllAvailableFilters(data);
            } catch (error) {
                console.error('Error fetching all filters:', error);
            } finally {
                setIsLoadingFilters(false);
            }
        };

        fetchAllFilters();
    }, []);

    const handleToggleFilter = (id) => {
        setActiveFilters(prevRows =>
        prevRows.map(row =>
            row.id === id ? { ...row, isSelected: !row.isSelected } : row
        )
        );
    };

    return (
        <div className="sidebar-filter-section">
            <div className="sidebar-filter-container">
                <div className="sidebar-filter-header">
                    <h4 className="sidebar-section-subtitle">Content Filters</h4>
                    <div className="sidebar-filter-edit">
                        {canModifyFilters &&
                            <button className="icon-button" onClick={(e) => { e.preventDefault(); setSubPanel('filterEdit'); }}>
                                <MdEdit size={20} />
                            </button>
                        }
                    </div>
                </div>
                <div className="sidebar-current-filters">
                    {allAvailableFilters && allAvailableFilters.length > 0 ? (
                        allAvailableFilters.map(filter => {
                            const styles = getStyles(filter.color);
                            const selectedFilter = activeFilters.find(row => row.id === filter.id);
                            const isActive = selectedFilter ? selectedFilter.isSelected : false;
                            return (
                                <button
                                    key={filter.id}
                                    className={`filter-button ${isActive ? 'filter-button-active' : ''}`}
                                    style={styles}
                                    onClick={() => {handleToggleFilter(filter.id)}}
                                >
                                    {filter.name}
                                </button>
                            )
                        })
                    ) : (
                        <p className="sidebar-text-gray">No filters assigned.</p>
                    )}
                </div>
            </div>

        </div>
    )
}

export default FilterGroup;