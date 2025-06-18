import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate

/**
 * Signup component for user registration.
 * Handles username and password input, and calls the signup function.
 */
function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // Initialize navigate

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // API call to the backend for signup
      const response = await fetch('/api/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          admin: false, // Default to non-admin
          login_allowed: true // Default to login disabled, admin must enable (as per backend logic)
        }),
      });

      if (response.ok) {
        setMessage('Sign up successful! Please contact an administrator to enable your login.');
        navigate('/login'); // Redirect to login page after successful signup
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Sign up failed.');
      }
    } catch (err) {
      console.error('Signup network error:', err);
      setError('Network error during signup.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2 className="login-header">Sign Up</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-username-group">
            <label htmlFor="username" className="login-username-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="login-username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              aria-label="Username"
            />
          </div>
          <div className="login-password-group">
            <label htmlFor="password" className="login-password-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="login-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Password"
            />
          </div>
          <div className="login-password-group">
            <label htmlFor="confirmPassword" className="login-password-label">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              className="login-password-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-label="Confirm Password"
            />
          </div>
          {error && (
            <div className="message-error">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586l-1.293-1.293z" clipRule="evenodd"></path></svg>
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="message">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              <span>{message}</span>
            </div>
          )}
          <button
            type="submit"
            className="login-submit-button"
          >
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition duration-200">
            &nbsp;&nbsp;Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
