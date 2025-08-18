import React, { useState, useEffect, useRef } from 'react';

// Reusable Context Menu Component
const ContextMenu = ({ x, y, isOpen, onClose, thumbnailData, onMenuItemClick, setContextMenu }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { label: "Select", action: "select" },
    { label: "Move", action: "move" },
    { label: "Delete", action: "delete" },
  ];

  return (
    <>
    <div
      className="context-menu"
      ref={menuRef}
      style={{ top: y, left: x }}
    >
      <ul className="context-menu-list">
        {menuItems.map((item) => (
          <li
            key={item.action}
            className="context-menu-item"
            onClick={() => {
              onMenuItemClick(item.action, thumbnailData);
              onClose(); // Close menu after clicking an item
            }}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
    </>
  );
};

export default ContextMenu;
