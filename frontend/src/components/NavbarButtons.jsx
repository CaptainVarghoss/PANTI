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
                {filters.map(filter => {
                    if (!filter.header_display) return null;

                    const isActive = filter.activeStageIndex > 0; // The filter is only visually active if not in the main stage (index 0)
                    const stageNames = ['main', 'second', 'third'];
                    const activeStageName = isActive ? stageNames[filter.activeStageIndex] : 'main'; // Default to main if inactive

                    const activeColorName = filter[`${activeStageName}_stage_color`];
                    const activeIcon = filter[`${activeStageName}_stage_icon`];

                    return (
                        <button 
                            key={filter.id} 
                            className={`btn-base filter-menu-button ${isActive ? 'active' : ''} ${filter.activeStageIndex !== -1 && activeColorName ? activeColorName : ''}`}
                            onClick={() => handleFilterToggle(filter.id)}
                            dangerouslySetInnerHTML={{ __html: activeIcon || '' }}
                            title={filter.name}
                        >
                        </button>
                    );
                })}
            </li>            
        </>
    );
}

export default NavbarButtons;