import React, { useState, useEffect, useRef } from 'react';

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonColor = "#2563eb", // Blue-600
  cancelButtonColor = "#ef4444"  // Red-500
}) => {
  // Ref for the modal content to detect clicks outside
  const modalRef = useRef(null);

  // Handle clicks outside the modal content to close it
  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="confirmation-dialog-overlay" onClick={handleClickOutside}>
      <style>
        {`
        .confirmation-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.6); /* Semi-transparent black overlay */
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000; /* Ensure it's on top of other content */
            font-family: 'Inter', sans-serif;
        }

        .confirmation-dialog-content {
            background-color: #ffffff;
            padding: 2rem;
            border-radius: 0.75rem; /* Rounded corners */
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2), 0 5px 10px rgba(0, 0, 0, 0.1); /* Soft shadow */
            width: 90%;
            max-width: 400px; /* Max width for larger screens */
            text-align: center;
            animation: fadeInScale 0.3s ease-out forwards; /* Simple animation */
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            position: relative; /* For responsive positioning */
            box-sizing: border-box; /* Include padding in width */
        }

        @keyframes fadeInScale {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .dialog-title {
            font-size: 1.5rem; /* text-2xl */
            font-weight: 700; /* font-bold */
            color: #1f2937; /* text-gray-800 */
            margin-bottom: 0.5rem;
        }

        .dialog-message {
            font-size: 1rem; /* text-base */
            color: #4b5563; /* text-gray-700 */
            line-height: 1.5;
            margin-bottom: 1rem;
        }

        .dialog-actions {
            display: flex;
            justify-content: center;
            gap: 1rem; /* space-x-4 */
            margin-top: 1rem;
        }

        .dialog-button {
            padding: 0.75rem 1.5rem; /* px-6 py-3 */
            border-radius: 0.5rem; /* rounded-lg */
            font-weight: 600; /* font-semibold */
            cursor: pointer;
            border: none;
            transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out, box-shadow 0.2s ease-in-out;
            outline: none; /* Remove default focus outline */
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Soft shadow for buttons */
        }

        .dialog-button:hover {
            transform: translateY(-1px); /* Slight lift on hover */
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .dialog-button:active {
            transform: translateY(0); /* Press effect */
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .dialog-button:focus {
            box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.2); /* Basic focus ring */
        }

        .confirm-button {
            background-color: ${confirmButtonColor};
            color: #ffffff;
        }
        .confirm-button:hover {
            background-color: ${confirmButtonColor}cc; /* Darker on hover */
        }
        .confirm-button:focus {
            box-shadow: 0 0 0 3px ${confirmButtonColor}80; /* The 80 makes it semi-transparent */
        }

        .cancel-button {
            background-color: #d1d5db; /* gray-300 */
            color: #374151; /* gray-700 */
        }
        .cancel-button:hover {
            background-color: #9ca3af; /* gray-400 */
        }
        .cancel-button:focus {
            box-shadow: 0 0 0 3px #d1d5db80;
        }
        `}
      </style>
      <div className="confirmation-dialog-content" ref={modalRef}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button
            className="dialog-button cancel-button"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            className="dialog-button confirm-button"
            onClick={onConfirm}
            style={{ backgroundColor: confirmButtonColor }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;


/* Example use of the component

<ConfirmationDialog
  isOpen={showConfirmDialog}
  onClose={() => setShowConfirmDialog(false)} // Callback for when dialog is closed/canceled
  onConfirm={() => {
    // Your logic to execute on confirmation
    console.log("Action confirmed!");
    setShowConfirmDialog(false); // Close dialog after confirmation
  }}
  title="Delete Tag"
  message="Are you sure you want to delete this tag? This action cannot be undone."
  confirmText="Delete"
  cancelText="Keep"
  confirmButtonColor="#dc2626" // Example: use a red color for destructive actions
/>


// Example click handler

const handleDeleteClick = () => {
  setShowConfirmDialog(true);
};


// Example state

const [showConfirmDialog, setShowConfirmDialog] = useState(false);

*/