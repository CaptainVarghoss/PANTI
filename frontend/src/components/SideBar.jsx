import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // To check user roles for admin links

/**
 * A reusable Sidebar component that slides in and out using standard CSS.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the sidebar.
 * @param {function} props.onClose - Callback function to close the sidebar.
 */
function Sidebar({ isOpen, onClose, side }) {
  const { isAdmin } = useAuth(); // Get admin status from AuthContext
  const sidebarClasses = `sidebar sidebar--${side} ${isOpen ? `sidebar--${side}--open` : ''}`;
  const overlayClasses = `sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`;

  return (
    <>
      {/* Overlay: clickable to close sidebar, visible when open */}
      <div className={overlayClasses} onClick={onClose} aria-hidden="true"></div>

      {/* Sidebar content */}
      <div className={sidebarClasses}>
        <div className={`sidebar-header sidebar-header--${side}`}>
          <button onClick={onClose} className="navbar-toggle-button" aria-label="Close menu">
            <svg className="navbar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            onClick={onClose}
            className="sidebar-link"
          >
            Home (Image Grid)
          </Link>
          {/* Example of an admin-only link */}
          {isAdmin && (
            <Link
              to="/tags"
              onClick={onClose}
              className="sidebar-link"
            >
              Manage Tags (Admin)
            </Link>
          )}
          {/* Add more menu items here */}
          <a
            href="https://github.com/your-repo/your-fullstack-app" // Replace with your actual GitHub repo
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link"
          >
            GitHub Repo
          </a>
        </nav>
      </div>
    </>
  );
}

export default Sidebar;