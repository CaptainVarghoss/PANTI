import React from 'react';
import * as MdIcons from 'react-icons/md'; // Import all icons


function NavbarButtons({
    toggleNavOpen,
    navOpen,
    handleFilterToggle,
    filters
}) {

    return (
        <>
            <li>
                <button onClick={toggleNavOpen} className="btn-base btn-primary" title={navOpen ? "Close Menu" : "Open Menu"}>
                    {navOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z"/></svg>
                    )}
                </button>
            </li>
            <li>
                {filters.map(filter => {
                    if (!filter.header_display) return null;

                    const isActive = filter.activeStageIndex > 0;
                    const stageNames = ['main', 'second', 'third'];
                    const activeStageName = isActive ? stageNames[filter.activeStageIndex] : 'main';

                    const activeColorName = filter[`${activeStageName}_stage_color`];
                    const activeIconName = filter[`${activeStageName}_stage_icon`];

                    // Dynamically get the Icon component from MdIcons
                    const IconComponent = activeIconName ? MdIcons[activeIconName] : null;

                    return (
                        <button 
                            key={filter.id} 
                            className={`btn-base filter-menu-button ${isActive ? 'active' : ''} ${filter.activeStageIndex !== -1 && activeColorName ? activeColorName : ''}`}
                            onClick={() => handleFilterToggle(filter.id)}
                            title={filter.name}
                        >
                            {/* Render the icon component if it exists, otherwise render nothing */}
                            {IconComponent && <IconComponent size={20} />}
                        </button>
                    );
                })}
            </li>            
        </>
    );
}

export default NavbarButtons;