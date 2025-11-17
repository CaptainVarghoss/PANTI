import React, { useState, useEffect, useRef } from 'react';

// Reusable Context Menu Component
const ContextMenu = ({ x, y, isOpen, onClose, thumbnailData, onMenuItemClick, menuItems, setContextMenu }) => {
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

  const defaultMenuItems = [
    { label: "Select", action: "select" },
    // { label: "Move", action: "move" }, // Move will be in the selection toolbar
    { label: "Delete", action: "delete" },
  ];

  const itemsToRender = menuItems || defaultMenuItems;

  return (
    <>
    <div
      className="context-menu"
      ref={menuRef}
      style={{ top: y, left: x }}
    >
      <ul className="context-menu-list">
        {itemsToRender.map((item) => (
          <li
            key={item.action}
            className="context-menu-item"
            onClick={() => {
              onMenuItemClick(item.action, thumbnailData, itemsToRender);
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
