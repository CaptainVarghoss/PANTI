import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Login component for user authentication.
 * Handles username and password input, and calls the login function from AuthContext.
 */
function Login({ onSwitchToSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Effect to redirect if already authenticated
  useEffect(() => {
    // This component should not be mounted if authenticated, but as a safeguard:
    if (isAuthenticated && navigate) {
      navigate('/'); // Redirect to home page if already logged in
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    // Call the centralized login function from AuthContext
    const result = await login(username, password);

    if (result.success) {
      // Login successful. The useEffect above will handle the navigation
      // because `isAuthenticated` state in AuthContext will change to true.
      console.log("Login successful, navigation handled by useEffect.");
    } else {
      // Login failed. AuthContext has already set the error.
      // Display it here.
      setError(result.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <div className="login-header">
          <h2 className="login-header-title">Login</h2>
        </div>
        <div className="login-body">
          <form onSubmit={handleSubmit} className="login-form login-body-inner">
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
            {error && (
              <div className="">
                <svg className="" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586l-1.293-1.293z" clipRule="evenodd"></path></svg>
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              className="login-submit-button"
            >
              Log In
            </button>
          </form>
        </div>

        <div className="login-body"> 
          <div className="login-body-inner">
            <p className="signup-link">
              Don't have an account?{' '}
              <button onClick={onSwitchToSignup} className="link-button">
                Sign up here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
