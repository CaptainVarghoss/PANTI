import React from 'react';

/**
 * A reusable toggle switch component.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOn - Current state of the switch (on/off).
 * @param {function} props.handleToggle - Callback function to toggle the switch state.
 * @param {string} [props.label] - Optional label for the switch.
 * @param {boolean} [props.disabled=false] - Whether the switch is disabled.
 */
const Switch = ({ isOn, handleToggle, label, disabled = false }) => {
  return (
    <div className="switch-container">
      {label && <span className="switch-label">{label}</span>}
      <label className={`switch ${disabled ? 'switch--disabled' : ''}`}>
        <input
          type="checkbox"
          checked={isOn}
          onChange={handleToggle}
          disabled={disabled}
        />
        <span className="slider round"></span>
      </label>
    </div>
  );
};

export default Switch;
