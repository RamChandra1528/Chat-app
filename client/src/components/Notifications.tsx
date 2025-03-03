import React, { useState, useEffect } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { connectSocket, getSocket } from '../socket';

type NotificationsProps = {
  username: string;
};

const Notifications: React.FC<NotificationsProps> = ({ username }) => {
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();

    const socketInstance = connectSocket();
    socketInstance.on('new_notification', (data: { message: string }) => {
      setNotifications(prev => [...prev, data.message]);
    });

    return () => {
      socketInstance.off('new_notification');
    };
  }, [username]);

  const fetchNotifications = () => {
    setIsLoading(true);
    setError(null);
    fetch('http://localhost:5000/api/notifications', { credentials: 'include' })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch notifications');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications);
        } else {
          setError(data.message || 'Failed to load notifications');
        }
      })
      .catch(error => {
        console.error('Error fetching notifications:', error);
        setError('Network error. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  const clearNotifications = () => {
    setIsLoading(true);
    setError(null);
    fetch('http://localhost:5000/api/notifications', {
      method: 'DELETE',
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to clear notifications');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setNotifications([]);
        } else {
          setError(data.message || 'Failed to clear notifications');
        }
      })
      .catch(error => {
        console.error('Error clearing notifications:', error);
        setError('Network error. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center">
          <Bell className="mr-2" /> Notifications
        </h2>
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="flex items-center text-red-500 hover:text-red-700 p-2 rounded hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            <Trash2 size={18} className="mr-1" /> Clear All
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex-grow overflow-y-auto">
        {isLoading && notifications.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <Bell size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification, index) => (
              <li
                key={index}
                className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500 text-gray-800"
              >
                {notification}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notifications;