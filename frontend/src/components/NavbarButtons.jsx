import React, {useState} from 'react';
import SettingsButton from './SettingsButton';


function NavbarButtons({
    toggleNavOpen,
    navOpen,
    handleFilterToggle,
    filters
}) {

    return (
        <>
            <li>
                <button onClick={toggleNavOpen} className="btn-base btn-primary">
                {navOpen ? <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z"/></svg>}
                </button>
            </li>
            <li>
                {filters.map(filter => (
                    filter.header_display === true && (
                    <button 
                        key={filter.id} 
                        className={`btn-base btn-red filter-menu-button ${filter.isSelected ? 'active' : ''}`}
                        onClick={() => handleFilterToggle(filter.id)}
                        dangerouslySetInnerHTML={{ __html: filter.icon }}
                        >
                    </button>
                    )
                ))}
            </li>            
        </>
    );
}

export default NavbarButtons;