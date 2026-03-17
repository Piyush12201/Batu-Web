import React, { useState, useEffect } from 'react';
import apiClient from '../services/api.client';
import socketService from '../services/socket.service';
import './ActivityFeedPage.css';

interface Activity {
  id: string;
  type: 'like' | 'comment' | 'connection' | 'post' | 'opportunity';
  actor_name: string;
  actor_id: string;
  message: string;
  action_text?: string;
  related_content?: string;
  created_at: string;
  is_read: boolean;
}

const ActivityFeedPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  useEffect(() => {
    const initialize = async () => {
      await fetchActivities();
      // Mark all notifications as read
      await apiClient.markAllNotificationsAsRead().catch(err => 
        console.error('Error marking all as read:', err)
      );
    };

    initialize();

    // Listen for new notifications via Socket.IO
    socketService.on('notification:new', handleNewNotification);

    return () => {
      socketService.off('notification:new', handleNewNotification);
    };
  }, []);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getNotifications();
      
      let notificationsArray: any[] = [];
      if (response.data) {
        // Support multiple possible response shapes
        if (Array.isArray(response.data)) {
          notificationsArray = response.data;
        } else if (typeof response.data === 'object') {
          const data = response.data as any;
          if (Array.isArray(data.data)) {
            notificationsArray = data.data;
          } else if (Array.isArray(data.notifications)) {
            notificationsArray = data.notifications;
          }
        }
      }
      
      if (Array.isArray(notificationsArray)) {
        const normalized = notificationsArray.map((item: any) => ({
          ...item,
          actor_name: item.actor_name || item.user_name || 'Someone',
          message: item.message || item.action_text || '',
          action_text: item.message || item.action_text || '',
        }));
        setActivities(normalized);
        setSelectedActivity(normalized[0] || null);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewNotification = (notification: Activity) => {
    const normalized = {
      ...notification,
      actor_name: notification.actor_name || 'Someone',
      message: notification.message || notification.action_text || '',
      is_read: false
    };
    setActivities((prev) => [normalized, ...prev]);
    setSelectedActivity(normalized);
  };

  const handleMarkAsRead = async (activityId: string) => {
    try {
      await apiClient.markNotificationAsRead(activityId);
      setActivities(activities.map(a => 
        a.id === activityId ? { ...a, is_read: true } : a
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getActivityCode = (type: string) => {
    const codes: { [key: string]: string } = {
      like: 'LK',
      comment: 'CM',
      connection: 'CN',
      post: 'PS',
      opportunity: 'OP',
    };
    return codes[type] || 'NT';
  };

  const getTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

  const unreadCount = activities.filter(a => !a.is_read).length;
  const visibleActivities = filterMode === 'unread'
    ? activities.filter((activity) => !activity.is_read)
    : activities;

  if (isLoading) {
    return <div className="page-container"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="activity-feed-page">
      <div className="activity-hero">
        <div>
          <h1>Notifications</h1>
          <p className="activity-subtitle">Signal Stream for likes, comments, connections, and opportunity updates.</p>
        </div>
        <div className="activity-hero-stats">
          <div className="activity-stat-card">
            <span>All</span>
            <strong>{activities.length}</strong>
          </div>
          <div className="activity-stat-card">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </div>
        </div>
      </div>

      <div className="activity-toolbar">
        <div className="activity-filters">
          <button
            className={`activity-filter ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All
          </button>
          <button
            className={`activity-filter ${filterMode === 'unread' ? 'active' : ''}`}
            onClick={() => setFilterMode('unread')}
          >
            Unread
          </button>
        </div>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount} new</span>
        )}
      </div>

      {selectedActivity && (
        <div className="activity-spotlight">
          <div className={`activity-spotlight-type ${selectedActivity.type}`}>
            {getTypeLabel(selectedActivity.type)}
          </div>
          <div>
            <h3>{selectedActivity.actor_name}</h3>
            <p>{selectedActivity.message || selectedActivity.action_text}</p>
            {selectedActivity.related_content && (
              <small>{selectedActivity.related_content.substring(0, 140)}</small>
            )}
          </div>
          <time>
            {new Date(selectedActivity.created_at).toLocaleString()}
          </time>
        </div>
      )}

      {visibleActivities.length === 0 ? (
        <div className="empty-state">
          <p>No notifications yet</p>
          <p>You'll see notifications here when people interact with your content</p>
        </div>
      ) : (
        <div className="activities-list">
          {visibleActivities.map((activity) => (
            <div
              key={activity.id}
              className={`activity-item ${activity.is_read ? 'activity-read' : 'activity-unread'}`}
              onClick={() => {
                setSelectedActivity(activity);
                if (!activity.is_read) {
                  handleMarkAsRead(activity.id);
                }
              }}
            >
              <div className="activity-icon">
                <span className={`activity-icon-badge ${activity.type}`}>{getActivityCode(activity.type)}</span>
              </div>
              <div className="activity-content">
                <div className="activity-main">
                  <strong>{activity.actor_name}</strong>
                  <span className="activity-type"> {activity.type}</span>
                </div>
                <p className="activity-message">
                  {activity.message || activity.action_text}
                </p>
                {activity.related_content && (
                  <p className="activity-related">"{activity.related_content.substring(0, 100)}"</p>
                )}
              </div>
              <div className="activity-time">
                {new Date(activity.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              {!activity.is_read && <div className="activity-unread-indicator"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeedPage;
