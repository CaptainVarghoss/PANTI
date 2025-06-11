import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ImageGrid from "./components/ImageGrid";
import Login from './pages/Login';
import Signup from './pages/Signup';
import './App.css';


const PublicOnlyRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If already authenticated, redirect to home page
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="">
        Loading authentication...
      </div>
    );
  }

  // If not authenticated, redirect to login
  // If authenticated but not admin, show forbidden or redirect to home
  return isAuthenticated && isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();

  return (
    <nav className="bg-gray-800 p-4 text-white shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-400">Image Gallery</h1>
        <div className="space-x-4">
          {isAuthenticated ? (
            <>
              <span className="text-gray-300">Welcome, {user?.username}! {isAdmin && '(Admin)'}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
                Login
              </Link>
              <Link to="/signup" className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
                Signup
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

function App() {

  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <div className="min-h-screen bg-gray-900 text-gray-100">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes (accessible only if isAuthenticated) */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ImageGrid />} /> {/* Home page, protected */}
              {/* Add other user-accessible protected routes here */}
            </Route>

            {/* Catch-all for undefined routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <div className="image-grid">
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;