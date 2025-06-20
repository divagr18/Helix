import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { FaBell, FaCheck, FaExternalLinkAlt, FaSpinner } from 'react-icons/fa'; // Added FaSpinner
import { Link, useNavigate } from 'react-router-dom';

// Assuming AppNotification interface is defined (e.g., in src/types.ts or locally)
export interface AppNotification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string; // ISO string date
  repository_full_name?: string | null;
  link_url?: string | null;
  notification_type?: string; 
  get_notification_type_display?: string;
}

// Assuming getCookie is in utils.ts or similar
import { getCookie } from '../utils'; 
// Fallback getCookie if not imported elsewhere for this example


const POLLING_INTERVAL = 60000; // Poll every 60 seconds

export const NotificationsBell: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true for initial load
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setIsLoading(true);
    // Don't clear error immediately, only on success, so user sees persistent error
    // setError(null); 
    try {
      const response = await axios.get('/api/v1/notifications/', { withCredentials: true });
      setNotifications(response.data.notifications || []); // Ensure it's always an array
      setUnreadCount(response.data.unread_count || 0);   // Ensure it's always a number
      setError(null); // Clear error on successful fetch
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Could not load notifications. Please try again later.");
      // Optionally keep stale data:
      // setNotifications(prev => prev || []); 
      // setUnreadCount(prev => prev || 0);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, []); // Empty dependency array as it doesn't depend on component state/props

  // Fetch on mount and set up polling
  useEffect(() => {
    fetchNotifications(true); // Show loading spinner on initial component mount
    const intervalId = setInterval(() => fetchNotifications(false), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchNotifications]); // Add fetchNotifications to dependency array due to useCallback

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: number) => {
    // Optimistic update
    const originalNotifications = [...notifications];
    const originalUnreadCount = unreadCount;

    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => {
        const notification = originalNotifications.find(n => n.id === notificationId);
        return (notification && !notification.is_read) ? Math.max(0, prev - 1) : prev;
    });

    try {
      await axios.post(
        `/api/v1/notifications/${notificationId}/mark-read/`, 
        {}, 
        { 
          withCredentials: true,
          headers: { 'X-CSRFToken': getCookie('csrftoken') }
        }
      );
      // If server confirms, state is already updated. 
      // Could re-fetch for absolute certainty, but optimistic is usually fine.
      // fetchNotifications(); 
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert optimistic update on error
      setNotifications(originalNotifications);
      setUnreadCount(originalUnreadCount);
      alert("Failed to mark notification as read. Please try again."); // Simple error feedback
    }
  };
  
  const handleMarkAllAsRead = async () => {
    const unreadNotifs = notifications ? notifications.filter(n => !n.is_read) : [];
    if (unreadNotifs.length === 0) return;

    // TODO: Implement a backend endpoint /api/v1/notifications/mark-all-read/ (POST)
    // For now, this will make multiple API calls, which is inefficient.
    console.warn("Marking all as read via multiple API calls (inefficient). Implement backend endpoint.");
    setIsLoading(true); // Show a general loading state for the dropdown
    try {
      for (const notif of unreadNotifs) {
        await handleMarkAsRead(notif.id); // This already does optimistic update
      }
      // After all individual calls (or a single backend call), refresh from server
      await fetchNotifications(); 
    } catch (error) {
        alert("An error occurred while marking all notifications as read.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.link_url) {
      if (notification.link_url.startsWith('/')) { // Internal link
        navigate(notification.link_url);
      } else { // External link
        window.open(notification.link_url, '_blank', 'noopener noreferrer');
      }
    }
    setIsOpen(false); // Close dropdown after click
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications(notifications.length === 0); // Fetch if opening and list is empty
    }
    setIsOpen(prev => !prev);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={toggleDropdown} 
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : "No new notifications"}
        style={{ 
          background: 'none', border: 'none', color: '#c9d1d9', 
          cursor: 'pointer', fontSize: '1.6em',
          position: 'relative', padding: '8px'
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Notifications"
      >
        <FaBell />
        {unreadCount > 0 && (
          <span aria-hidden="true" style={{
            position: 'absolute', top: '0px', right: '0px', 
            backgroundColor: '#d9534f', color: 'white', borderRadius: '50%', 
            padding: '1px 5px', fontSize: '0.6em', fontWeight: 'bold',
            border: '1px solid #0d1117', lineHeight: '1'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '400px',
          backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000, 
          color: '#c9d1d9'
        }}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="notifications-button" // Assuming the button above has id="notifications-button"
        >
          <div style={{ 
            padding: '12px 15px', borderBottom: '1px solid #30363d', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Notifications</span>
            {notifications && notifications.filter(n => !n.is_read).length > 0 && ( // Defensive check
              <button 
                onClick={handleMarkAllAsRead}
                disabled={isLoading} // Disable while any loading is happening
                style={{fontSize: '0.8em', background: 'none', border: '1px solid #444', color: '#58a6ff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}}
              >
                Mark all as read
              </button>
            )}
          </div>
          
          {isLoading ? ( // Show spinner if isLoading is true
            <div style={{ padding: '30px', textAlign: 'center' }}> <FaSpinner className="animate-spin" size="1.5em" /> </div>
          ) : error ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#f85149' }}>{error}</div>
          ) : (!notifications || notifications.length === 0) ? ( // Defensive check
            <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>You're all caught up!</div>
          ) : (
            <div style={{maxHeight: '450px', overflowY: 'auto'}} role="list">
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  role="listitem"
                  tabIndex={0} // Make it focusable
                  onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(notif)} // Keyboard accessible
                  style={{ 
                    padding: '12px 15px', borderBottom: '1px solid #30363d', 
                    cursor: 'pointer',
                    backgroundColor: notif.is_read ? 'transparent' : '#20242c',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2a2e37'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = notif.is_read ? 'transparent' : '#20242c'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                    <span style={{ fontWeight: notif.is_read ? 'normal' : 'bold', fontSize: '0.95em' }}>
                      {notif.get_notification_type_display || 'Notification'}
                      {notif.repository_full_name && 
                        <span style={{color: '#8b949e', marginLeft: '5px', fontSize: '0.9em'}}>
                          on {notif.repository_full_name}
                        </span>
                      }
                    </span>
                    {!notif.is_read && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }} 
                        title="Mark as read"
                        aria-label={`Mark notification about ${notif.message.substring(0,20)} as read`}
                        style={{
                          background: 'none', border: 'none', color: '#58a6ff', 
                          cursor: 'pointer', padding: '0', fontSize: '0.9em', marginLeft: '10px'
                        }}
                      >
                        <FaCheck />
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '0 0 8px 0', color: notif.is_read ? '#8b949e' : '#c9d1d9', fontSize: '0.9em', lineHeight: '1.4' }}>
                    {notif.message}
                  </p>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <small style={{ color: '#6a737d', fontSize: '0.8em' }}>
                      {new Date(notif.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(notif.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </small>
                    {notif.link_url && (
                       <FaExternalLinkAlt style={{color: '#58a6ff', fontSize: '0.8em'}} title="View details"/>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
           {notifications && notifications.length > 0 && ( // Defensive check
             <div style={{padding: '10px', textAlign: 'center', borderTop: '1px solid #30363d'}}>
                {/* This link should ideally go to a dedicated /notifications page */}
                <button onClick={() => { console.log("Navigate to all notifications page"); setIsOpen(false); /* navigate('/notifications'); */ }} 
                        style={{color: '#58a6ff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', fontSize: '0.9em'}}>
                    View all notifications (Not Implemented)
                </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};