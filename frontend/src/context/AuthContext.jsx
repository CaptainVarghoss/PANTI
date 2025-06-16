import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true); // Initial loading for auth status
  const [error, setError] = useState(null);
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem('deviceId') || crypto.randomUUID());

  // NEW: State to hold all tiered settings with metadata
  const [settings, setSettings] = useState({}); // Tiered settings (name: value)
  const [rawSettingsList, setRawSettingsList] = useState([]); // List of full setting objects with metadata

  // Store deviceId in localStorage if it's new
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      localStorage.setItem('deviceId', deviceId);
    }
  }, [deviceId]);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
    setIsAdmin(userData?.admin || false);
    setError(null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setSettings({}); // Clear settings on logout
    setRawSettingsList([]); // Clear raw settings on logout
    setError(null);
  }, []);

  // NEW: Helper to parse setting values based on input_type
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

  // NEW/MODIFIED: Fetch all settings from backend (tiered view)
  const fetchSettings = useCallback(async () => {
    if (!token) {
      setSettings({});
      setRawSettingsList([]);
      return;
    }
    try {
      // Pass device_id as a query parameter
      const response = await fetch(`/api/settings/?device_id=${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
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
        // Optionally handle specific errors, e.g., if token is invalid, force logout
        if (response.status === 401 || response.status === 403) {
            console.error("AuthContext: Token expired or unauthorized fetching settings. Forcing logout.");
            logout();
        }
        setError("Failed to fetch settings.");
      }
    } catch (err) {
      console.error("Network error fetching settings:", err);
      setError("Network error fetching settings.");
    }
  }, [token, deviceId, logout, parseSettingValue]); // Depend on deviceId and parseSettingValue

  // Effect to authenticate user on token change or initial load
  useEffect(() => {
    const authenticateUser = async () => {
      setLoading(true);
      setError(null);
      if (token) {
        try {
          const response = await fetch('/api/users/me/', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setIsAuthenticated(true);
            setIsAdmin(userData.admin);
            // Fetch settings immediately after successful user authentication
            await fetchSettings();
          } else {
            console.error('Failed to verify token:', response.status, response.statusText);
            logout(); // Invalidate token if verification fails
          }
        } catch (err) {
          console.error('Network error during token verification:', err);
          logout(); // Treat network errors during auth check as logout
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        logout(); // No token, ensure logged out state
      }
    };

    authenticateUser();
  }, [token, logout, fetchSettings]); // Add fetchSettings to dependencies

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    token,
    user,
    isAuthenticated,
    isAdmin,
    loading,
    error,
    deviceId,
    settings, // NEW: Tiered settings (name: value map)
    rawSettingsList, // NEW: Full list of setting objects with metadata
    login,
    logout,
    fetchSettings, // Expose fetchSettings for manual refresh
  }), [token, user, isAuthenticated, isAdmin, loading, error, deviceId, settings, rawSettingsList, login, logout, fetchSettings]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
