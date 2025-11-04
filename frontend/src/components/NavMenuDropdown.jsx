import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A reusable component for a button with a dropdown in the navigation menu.
 * It handles its own open/close state and positioning.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.buttonContent - The content to display inside the button.
 * @param {string} props.buttonClassName - Additional class name for the button.
 * @param {React.ReactNode} props.children - The content of the dropdown.
 */
function NavMenuDropdown({ buttonContent, buttonClassName, children }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const toggleDropdown = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Handle outside click to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={wrapperRef} className="nav-menu-dropdown-wrapper">
            <button
                className={`${buttonClassName} ${isOpen ? 'active' : ''}`}
                onClick={toggleDropdown}
            >
                {buttonContent}
            </button>

            {isOpen && (
                <div className="nav-menu-dropdown-content">
                    {/* If children is a function, call it with props. Otherwise, render it directly. */}
                    {typeof children === 'function' ? children({ setIsOpen }) : children}
                </div>
            )}
        </div>
    );
}

export default NavMenuDropdown;