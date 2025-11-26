import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdEdit } from "react-icons/md";

function FilterGroup({ setSubPanel, activeFilters, setActiveFilters, allAvailableFilters }) {
    const { token, isAuthenticated, settings, isAdmin } = useAuth();

    const canModifyFilters = isAdmin;

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