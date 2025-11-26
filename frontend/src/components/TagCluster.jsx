import React, { useEffect, useRef } from 'react';

/**
 * A custom hook to handle clicks outside of a specified element.
 * @param {React.RefObject} ref - The ref of the element to monitor.
 * @param {Function} handler - The function to call when a click outside occurs.
 */
function useOutsideAlerter(ref, handler) {
    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                handler();
            }
        }
        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, handler]);
}

/**
 * Renders a popup menu of tags that can be toggled.
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.allTags - Array of all available tag objects.
 * @param {Set<number>} props.activeTagIds - A Set of IDs for currently active tags.
 * @param {Function} props.onTagToggle - Function to call when a tag is clicked.
 * @param {Function} props.onClose - Function to call to close the popup.
 */
function TagCluster({ allTags, activeTagIds, onTagToggle, onClose }) {
    const wrapperRef = useRef(null);
    useOutsideAlerter(wrapperRef, onClose);

    return (
        <div ref={wrapperRef} className="tag-cluster-popup">
            {allTags.map(tag => {
                const isActive = activeTagIds.has(tag.id);
                const tagClasses = `tag-badge ${isActive ? 'active' : ''} popup-tag`;

                return (
                    <span
                        key={tag.id}
                        className={tagClasses}
                        onClick={() => onTagToggle(tag)}
                    >
                        {tag.name}
                    </span>
                );
            })}
        </div>
    );
}

export default TagCluster;