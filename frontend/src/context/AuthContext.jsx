import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

// Create the AuthContext
export const AuthContext = createContext(null);

/**
 * Provides authentication state and functions to its children.
 * Manages access token storage, user data, login, and logout.
 */
export const AuthProvider = ({ children }) => {
  // Initialize token and user from localStorage (for persistence across sessions)
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Track initial loading of user data
  const navigate = useNavigate();

  // Function to save token to localStorage
  const saveToken = (newToken) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
  };

  // Function to fetch user data using the token
  const fetchUser = async (current_token) => {
    if (!current_token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/users/me/', {
        headers: {
          'Authorization': `Bearer ${current_token}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // If token is invalid or expired, clear it
        console.error("Failed to fetch user data, token might be invalid or expired.");
        saveToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      saveToken(null); // Clear token on network/other errors
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Effect to load user data when token changes or on initial load
  useEffect(() => {
    fetchUser(token);
  }, [token]);

  // Login function
  const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        saveToken(data.access_token);
        // fetchUser will be called by useEffect due to token change
        navigate('/'); // Redirect to home page after successful login
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData.detail);
        return { success: false, message: errorData.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Network error during login:', error);
      return { success: false, message: 'Network error during login' };
    }
    return { success: true };
  };

  // Signup function
  const signup = async (username, password, admin = false, login_allowed = false) => {
    try {
      const response = await fetch('/api/signup/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, admin, login_allowed }),
      });

      if (response.ok) {
        // Optionally log in the user immediately after signup
        // await login(username, password);
        return { success: true, message: "Signup successful. You can now log in." };
      } else {
        const errorData = await response.json();
        console.error('Signup failed:', errorData.detail);
        return { success: false, message: errorData.detail || 'Signup failed' };
      }
    } catch (error) {
      console.error('Network error during signup:', error);
      return { success: false, message: 'Network error during signup' };
    }
  };

  // Logout function
  const logout = () => {
    saveToken(null);
    setUser(null);
    navigate('/login'); // Redirect to login page after logout
  };

  const isAdmin = user && user.admin;

  const authContextValue = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user, // User is authenticated if token and user data exist
    login,
    signup,
    logout,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access to AuthContext
export const useAuth = () => useContext(AuthContext);
