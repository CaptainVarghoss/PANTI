import React from 'react';

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
  onExit,
  customActions = []
}) {
  return (
    <div className="selection-toolbar">
        
        
        <button onClick={onSelectAll} className="btn-base btn-primary toolbar-button">
          Select All
        </button>
        <button onClick={onClearSelection} className="btn-base btn-primary toolbar-button" disabled={selectedCount === 0}>
          Deselect All
        </button>
        <button onClick={onExit} className="btn-base btn-primary exit-selection-button" title="Exit Select Mode">
          Close
        </button>
        <span className="selection-count">{selectedCount} selected</span>
        {customActions.length > 0 ? (
            customActions.map((action, index) => (
                <button
                    key={index}
                    onClick={action.handler}
                    className={`btn-base btn-primary toolbar-button ${action.danger ? 'toolbar-button-danger' : ''}`}
                    disabled={selectedCount === 0}
                >
                    {action.label}
                </button>
            ))
        ) : (
            // This part is now effectively a fallback, as customActions will always be provided.
            <>
                <button onClick={onMove} className="toolbar-button" disabled={selectedCount === 0}>Move</button>
                <button onClick={onDelete} className="toolbar-button toolbar-button-danger" disabled={selectedCount === 0}>Delete</button>
            </>
        )}
      </div>
  );
}

export default SelectionToolbar;