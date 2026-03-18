import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import NetworkPage from './pages/NetworkPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AdminUserProfilePage from './pages/AdminUserProfilePage';
import ActivityFeedPage from './pages/ActivityFeedPage';
import HomePage from './pages/HomePage';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to={isAdmin ? '/admin' : '/feed'} />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return isAdmin ? <>{children}</> : <Navigate to="/feed" />;
};

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={
          <PublicRoute>
            <HomePage />
          </PublicRoute>
        } />
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        
        <Route element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/activity" element={<ActivityFeedPage />} />
        </Route>
        
        {/* Admin Route - Standalone without sidebar */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        } />
        <Route path="/admin/profile/:userId" element={
          <AdminRoute>
            <AdminUserProfilePage />
          </AdminRoute>
        } />
      </Routes>
    </div>
  );
}

export default App;
