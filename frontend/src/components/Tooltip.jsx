import React, { useState } from 'react';

/**
 * A reusable tooltip component that displays text on hover.
 *
 * @param {object} props - Component props.
 * @param {string} props.content - The text content to display in the tooltip.
 * @param {string} [props.position='top'] - The position of the tooltip relative to the icon.
 * @param {string} [props.icon='?'] - The icon to hover over (can be any character/string).
 */
const Tooltip = ({ content, position = 'top', icon = '?' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span className="tooltip-container">
      <span
        className="tooltip-icon"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)} // Toggle on click for mobile
      >
        {icon}
      </span>
      {showTooltip && (
        <div className={`tooltip-content tooltip-${position}`}>
          {content}
        </div>
      )}
    </span>
  );
};

export default Tooltip;