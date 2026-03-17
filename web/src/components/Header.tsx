import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socket.service';
import apiClient from '../services/api.client';
import batuLogo from '../../assets/batu_logo-removebg-preview.png';
import './Header.css';

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    fetchUnreadCounts();

    // Listen for real-time updates
    socketService.on('message:new', handleNewMessage);
    socketService.on('notification:new', handleNewNotification);

    return () => {
      socketService.off('message:new', handleNewMessage);
      socketService.off('notification:new', handleNewNotification);
    };
  }, []);

  const fetchUnreadCounts = async () => {
    try {
      const [messagesRes, notificationsRes] = await Promise.all([
        apiClient.getUnreadCount(),
        apiClient.getUnreadNotificationsCount(),
      ]);

      if (messagesRes.data) {
        const msgData = messagesRes.data as any;
        setUnreadMessages(msgData.count ?? msgData.unread_count ?? 0);
      }
      if (notificationsRes.data) {
        const notifData = notificationsRes.data as any;
        setUnreadNotifications(notifData.count ?? notifData.unread_count ?? 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
    }
  };

  const handleNewMessage = () => {
    setUnreadMessages((prev) => prev + 1);
  };

  const handleNewNotification = () => {
    setUnreadNotifications((prev) => prev + 1);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <button className="menu-button" onClick={onMenuClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <Link to="/feed" className="header-logo">
            <img src={batuLogo} alt="BATU" className="header-logo-image" />
            <div className="header-brand-text">
              <h1>Alumni Connect</h1>
              <span>Dr. Babasaheb Ambedkar Technological University</span>
            </div>
          </Link>
        </div>

        <div className="header-right">
          <Link to="/messages" className="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {unreadMessages > 0 && (
              <span className="badge">{unreadMessages}</span>
            )}
          </Link>

          <Link to="/activity" className="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadNotifications > 0 && (
              <span className="badge">{unreadNotifications}</span>
            )}
          </Link>

          <div className="profile-menu">
            <button
              className="profile-button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              {user?.profile_picture || user?.profile_picture_url ? (
                <img src={user.profile_picture_url || user.profile_picture} alt={user.full_name} />
              ) : (
                <div className="profile-avatar">
                  {user?.full_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-name">{user?.full_name}</div>
                  <div className="profile-dropdown-email">{user?.email}</div>
                </div>
                <div className="profile-dropdown-divider" />
                <Link to="/profile" className="profile-dropdown-item" onClick={() => setShowProfileMenu(false)}>
                  My Profile
                </Link>
                {user?.is_admin && (
                  <Link to="/admin" className="profile-dropdown-item" onClick={() => setShowProfileMenu(false)}>
                    Admin Panel
                  </Link>
                )}
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
