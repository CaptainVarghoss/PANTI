import React, { useCallback } from 'react';

function NavMenuBar({
    navOpen,
    setNavOpen,
    isSelectMode,
    setIsSelectMode,
    onExitSelectMode,
    currentView,
    setCurrentView
}) {

    return (
        <>
            <div className="navbar-menu-sub">
                <div className="left-spacer"></div>
                <div className="layout-buttons">
                    <button
                        className={`grid-button ${currentView === 'grid' ? 'active' : ''}`}
                        onClick={() => setCurrentView('grid')}
                        title="Grid Layout"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960">
                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120zm0-80h133v-133H200zm213 0h134v-133H413zm214 0h133v-133H627zM200-413h133v-134H200zm213 0h134v-134H413zm214 0h133v-134H627zM200-627h133v-133H200zm213 0h134v-133H413zm214 0h133v-133H627z"/>
                        </svg>
                    </button>
                    <button
                        className={`folders-button ${currentView === 'folders' ? 'active' : ''}`}
                        title="Folder Layout"
                        onClick={() => setCurrentView('folders')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160zm0-80h640v-400H447l-80-80H160zm0 0v-480z"/></svg>
                    </button>
                </div>
                <div className="right-spacer">
                    <button
                        className={`select-button ${isSelectMode ? 'active' : ''}`}
                        title="Select Multiple"
                        onClick={() => setIsSelectMode(!isSelectMode)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M200-200v80q-33 0-56.5-23.5T120-200zm-80-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm80-160h-80q0-33 23.5-56.5T200-840zm80 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 640v-80h80v80zm0-640v-80h80v80zm160 560h80q0 33-23.5 56.5T760-120zm0-80v-80h80v80zm0-160v-80h80v80zm0-160v-80h80v80zm0-160v-80q33 0 56.5 23.5T840-760z"/></svg>
                        <span>Select</span>
                    </button>
                </div>
            </div>
        </>
    );

}

export default NavMenuBar;