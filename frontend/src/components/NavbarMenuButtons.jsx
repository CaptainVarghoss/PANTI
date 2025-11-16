import React, {useState} from 'react';
import SettingsButton from './SettingsButton';

function NavbarMenuButtons({
    side,
}) {

    return (
        <div className={`navbar-menu-buttons side-${side}`}>
            <SettingsButton />
            <button className="trash-button" title="View Trash"> 
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120zm400-600H280v520h400zM360-280h80v-360h-80zm160 0h80v-360h-80zM280-720v520z"/></svg>
            </button>
            <button className="filters-button" title="Manage Filters">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M400-240v-80h160v80zM240-440v-80h480v80zM120-640v-80h720v80z"/></svg>
            </button>
        </div>
    );
}

export default NavbarMenuButtons;