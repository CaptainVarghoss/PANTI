import React, { useState } from 'react';
import Login from '../pages/Login';
import Signup from '../pages/Signup';

/**
 * A component that renders the Login or Signup form and allows switching between them.
 * This is shown to users who are not authenticated.
 */
function UnauthenticatedApp() {
  const [showLogin, setShowLogin] = useState(true);

  if (showLogin) {
    // Pass a function to Login so it can trigger the switch to Signup
    return <Login onSwitchToSignup={() => setShowLogin(false)} />;
  } else {
    // Pass a function to Signup so it can trigger the switch to Login
    return <Signup onSwitchToLogin={() => setShowLogin(true)} />;
  }
}

export default UnauthenticatedApp;