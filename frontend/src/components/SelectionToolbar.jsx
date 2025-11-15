import React from 'react';
import { IoMdClose } from "react-icons/io";

/**
 * A toolbar that appears when in selection mode, providing bulk actions.
 *
 * @param {object} props - Component props.
 * @param {number} selectedCount - The number of currently selected items.
 * @param {function} onClearSelection - Callback to clear the current selection.
 * @param {function} onSelectAll - Callback to select all visible items.
 * @param {function} onDelete - Callback to delete all selected items.
 * @param {function} onMove - Callback to move all selected items.
 * @param {function} onExit - Callback to exit selection mode.
 */
function SelectionToolbar({
  selectedCount,
  onClearSelection,
  onSelectAll,
  onDelete,
  onMove,
  onExit
}) {
  return (
    <div className="selection-toolbar">
        
        
        <button onClick={onSelectAll} className="toolbar-button">
          Select All
        </button>
        <button onClick={onClearSelection} className="toolbar-button" disabled={selectedCount === 0}>
          Deselect All
        </button>
        <button onClick={onExit} className="exit-selection-button" title="Exit Select Mode">
          Clear
        </button>
        <span className="selection-count">{selectedCount} selected</span>
        <button onClick={onMove} className="toolbar-button" disabled={selectedCount === 0}>
          Move
        </button>
        <button onClick={onDelete} className="toolbar-button toolbar-button-danger" disabled={selectedCount === 0}>
          Delete
        </button>
      </div>
  );
}

export default SelectionToolbar;