import React, { useState, useEffect, useRef } from 'react';
import TagCluster from './TagCluster';

// Reusable Context Menu Component
const ContextMenu = ({ x, y, isOpen, onClose, thumbnailData, onMenuItemClick, menuItems, images, selectedImageIds }) => {
  const menuRef = useRef(null);
  const [showTagCluster, setShowTagCluster] = useState(false);
  const prevIsOpenRef = useRef(isOpen);

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

    // If the image associated with the context menu is removed from the view, close the menu.
    if (thumbnailData && images && !images.find(img => img.id === thumbnailData.id)) {
      onClose();
    }

    // Reset the tag cluster view only when the menu is newly opened, not on every re-render.
    if (isOpen && !prevIsOpenRef.current) {
      setShowTagCluster(false);
    }
    prevIsOpenRef.current = isOpen;

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, thumbnailData, images]);

  if (!isOpen) return null;

  const defaultMenuItems = [
    { label: "Select", action: "select" },
    { label: "Move", action: "move" },
    { label: "Delete", action: "delete" },
  ];

  const itemsToRender = menuItems || defaultMenuItems;

  const handleItemClick = (item) => {
    if (item.action === 'add_tag') {
      setShowTagCluster(prev => !prev); // Toggle tag cluster visibility
    } else if (item.action === 'edit_tags_selected') {
      setShowTagCluster(prev => !prev); // Also use this for bulk edit
    } else {
      onMenuItemClick(item.action, thumbnailData || item, itemsToRender);
      onClose(); // Close menu for other actions
    }
  };

  return (
    <>
    <div
      className="context-menu"
      ref={menuRef}
      style={{ top: y, left: x }}
    >
      {showTagCluster ? (
        menuItems.find(item => item.action === 'edit_tags_selected') ? (
          <TagCluster.Popup
            type="image_tags_bulk"
            itemIds={selectedImageIds} // Pass the set of selected IDs
            onClose={() => {
              setShowTagCluster(false);
              onClose();
            }}
          />
        ) : (
          <TagCluster.Popup
            type="image_tags"
            itemId={thumbnailData.id}
            onClose={() => {
              setShowTagCluster(false);
              onClose(); // Also close the main context menu
            }}
          />
        )
      ) : (
        <ul className="context-menu-list">
          {itemsToRender.map((item) => (
            <li
              key={item.action}
              className="context-menu-item"
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
};

export default ContextMenu;
