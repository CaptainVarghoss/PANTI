import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Fallback function for crypto.randomUUID()
const generateFallbackUUID = () => {
  // A simple, generally unique enough ID for client-side device tracking
  // Not a true UUIDv4, but sufficient for this purpose if crypto.randomUUID is absent.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true); // Initial loading for auth status
  const [error, setError] = useState(null);

  const [deviceId, setDeviceId] = useState(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    if (storedDeviceId) {
      return storedDeviceId;
    }
    // Use crypto.randomUUID() if available, otherwise use fallback
    const newDeviceId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : generateFallbackUUID();
    localStorage.setItem('deviceId', newDeviceId);
    return newDeviceId;
  });

  // State to manage the 'use_device_settings' toggle, specific to the device form
  // This will control if device overrides are active or if global settings are read-only.
  const [useDeviceSettings, setUseDeviceSettings] = useState(() => {
    // Initialize from localStorage
    const storedValue = localStorage.getItem('use_device_settings_override');
    return storedValue === 'true';
  });

  // State to hold all tiered settings with metadata
  const [settings, setSettings] = useState({}); // Tiered settings (name: value)
  const [rawSettingsList, setRawSettingsList] = useState([]); // List of full setting objects with metadata

  // Helper to parse setting values based on input_type
  const parseSettingValue = useCallback((value, input_type) => {
    if (input_type === 'switch') {
      return value.toLowerCase() === 'true';
    }
    if (input_type === 'number') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num; // Return original string if not a valid number
    }
    return value; // Default to string
  }, []);

  // Fetch all settings from backend (tiered view)
  const fetchSettings = useCallback(async (authToken) => {
    // Only fetch settings if there's an authentication token
    if (!authToken) {
      console.log('not authorized for some reason')
      setSettings({});
      setRawSettingsList([]);
      return;
    }
    try {
      // The endpoint now correctly depends on the `useDeviceSettings` state.
      const endpoint = useDeviceSettings
        ? `/api/settings/?device_id=${deviceId}`
        : `/api/settings/`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${authToken}` // Use provided token for this fetch
        }
      });
      if (response.ok) {
        const data = await response.json(); // This will be List[schemas.Setting]
        setRawSettingsList(data); // Store the full list with metadata

        // Transform the list into a simple name-value map for easy access in components
        const newSettingsMap = {};

        data.forEach(setting => {
          newSettingsMap[setting.name] = parseSettingValue(setting.value, setting.input_type);
        });
        setSettings(newSettingsMap); // Store the processed values
      } else {
        console.error("Failed to fetch settings:", response.status, response.statusText);
        // If the token is invalid or unauthorized, it might indicate a session issue.
        // Do NOT call logout directly here to avoid loops. Let the main auth check handle it.
        setError("Failed to fetch settings.");
      }
    } catch (err) {
      console.error("Network error fetching settings:", err);
      setError("Network error fetching settings.");
    }
  }, [deviceId, parseSettingValue, useDeviceSettings]); // Add useDeviceSettings to dependencies

  // This new effect will specifically listen for changes in `useDeviceSettings`
  // and trigger a settings refresh. This is the key to making the toggle work globally.
  useEffect(() => {
    // We only want to refetch if the user is already authenticated.
    // On initial load, the main checkAuthStatus effect handles the first fetch.
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      fetchSettings(currentToken);
    }
  }, [useDeviceSettings, fetchSettings]); // Re-run when useDeviceSettings changes



  // The main login function - now handles the API calls
  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null); // Clear any previous errors

    try {
      // Step 1: Get Access Token from /api/token
      const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // Required for OAuth2PasswordRequestForm
        },
        body: new URLSearchParams({
          username: username,
          password: password,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        const errorMessage = errorData.detail || 'Login failed';
        setError(errorMessage);
        setLoading(false);
        return { success: false, message: errorMessage };
      }

      const tokenData = await tokenResponse.json();
      const newToken = tokenData.access_token;
      localStorage.setItem('token', newToken); // Store token in local storage

      // Step 2: Fetch User Data using the new token from /api/users/me/
      const userResponse = await fetch('/api/users/me/', {
        headers: {
          'Authorization': `Bearer ${newToken}`,
        },
      });

      if (!userResponse.ok) {
        localStorage.removeItem('token'); // Clear token if user data fetch fails (e.g., token invalid)
        const errorData = await userResponse.json();
        const errorMessage = errorData.detail || 'Failed to fetch user data after login.';
        setError(errorMessage);
        setLoading(false);
        return { success: false, message: errorMessage };
      }

      const userData = await userResponse.json();

      // Step 3: Update authentication states
      setToken(newToken);
      setUser(userData);
      setIsAuthenticated(true);
      setIsAdmin(userData.admin);

      // Step 4: Fetch settings using the new token and user data
      await fetchSettings(newToken); // Pass the new token explicitly

      setLoading(false);
      return { success: true, message: 'Login successful!' };

    } catch (err) {
      console.error('Login process error:', err);
      setError('Network error or unexpected issue during login.');
      setLoading(false);
      return { success: false, message: 'Network error or unexpected issue during login.' };
    }
  }, [fetchSettings]); // `fetchSettings` is a dependency as `login` calls it.

  // The logout function - purely client-side operation for JWT
  const logout = useCallback(() => {
    localStorage.removeItem('token'); // Remove token from local storage
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setSettings({}); // Clear settings on logout
    setRawSettingsList([]); // Clear raw settings on logout
    setError(null); // Clear any errors
    setLoading(false); // Ensure loading is false after logout
  }, []);

  // Effect to re-authenticate user on initial load or token changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        try {
          // Attempt to fetch user data using the stored token
          const response = await fetch('/api/users/me/', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            setToken(storedToken); // Ensure token state is set
            setUser(userData);
            setIsAuthenticated(true);
            setIsAdmin(userData.admin);
            await fetchSettings(storedToken); // Fetch settings for the authenticated user
          } else {
            console.error('Failed to verify token on startup:', response.status, response.statusText);
            logout(); // If token verification fails, consider the user logged out
          }
        } catch (err) {
          console.error('Network error during token verification on startup:', err);
          logout(); // Treat network errors during auth check as logout
        } finally {
          setLoading(false); // Authentication check is complete
        }
      } else {
        setLoading(false); // No token, so not authenticated
        logout(); // Ensure all auth states are reset to logged out
      }
    };

    checkAuthStatus();
  }, [logout, fetchSettings]); // Dependencies for useEffect: logout and fetchSettings

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    token,
    user,
    isAuthenticated,
    isAdmin,
    loading,
    error,
    deviceId,
    settings, // Tiered settings (name: value map)
    rawSettingsList, // Full list of setting objects with metadata
    login, // The centralized login function
    logout,
    fetchSettings, // Expose fetchSettings for manual refresh if needed
    useDeviceSettings,
    setUseDeviceSettings, // Expose the setter function
  }), [token, user, isAuthenticated, isAdmin, loading, error, deviceId, settings, rawSettingsList, login, logout, fetchSettings, useDeviceSettings]);

  return (
    <AuthContext.Provider value={{
      ...contextValue,
      // Create a new handler that updates both state and localStorage
      handleUseDeviceSettingsToggle: (newValue) => {
        localStorage.setItem('use_device_settings_override', newValue);
        setUseDeviceSettings(newValue);
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};
