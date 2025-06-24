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
    { label: "Download", action: "download" },
    { label: "View Info", action: "viewInfo" },
    { label: "Delete", action: "delete" },
  ];

  return (
    <>
    <style>
        {`
        /* Context Menu Styles */
        .context-menu {
            position: fixed;
            background-color: #ffffff;
            border-radius: 0.5rem; /* rounded-lg */
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 100;
            min-width: 160px;
            padding: 0.5rem 0;
            list-style: none; /* Remove default list styling */
        }

        .context-menu-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .context-menu-item {
            display: flex;
            align-items: center;
            padding: 0.75rem 1rem; /* py-3 px-4 */
            font-size: 0.95rem;
            color: #333;
            cursor: pointer;
            transition: background-color 0.15s ease;
        }

        .context-menu-item:hover {
            background-color: #f0f0f0;
        }

        .context-menu-icon {
            width: 1.1rem; /* h-5 w-5 */
            height: 1.1rem;
            margin-right: 0.75rem; /* mr-3 */
            color: #555;
        }
        `}
      </style>
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

/*

            className="thumbnail-card"
            onContextMenu={(e) => handleContextMenu(e, thumbnail)}

      <ContextMenu
        isOpen={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        thumbnailData={contextMenu.thumbnailData}
        onMenuItemClick={handleMenuItemClick}
      />
*/
export default ContextMenu;
