import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Bell, LogOut, User, Search } from 'lucide-react';
import Login from './components/Login';
import Register from './components/Register';
import ChatRoom from './components/ChatRoom';
import FriendsList from './components/FriendsList';
import Profile from './components/Profile';
import Notifications from './components/Notifications';
import { connectSocket, disconnectSocket } from './socket';

type User = {
  username: string;
  bio: string;
  avatar: string;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        connectSocket();
        // Verify session with backend
        fetch('http://localhost:5000/api/profile', { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setUser(data.user);
              localStorage.setItem('user', JSON.stringify(data.user));
            } else {
              handleLogout(); // Clear invalid session
            }
          })
          .catch(() => handleLogout());
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
    return () => disconnectSocket();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetch('http://localhost:5000/api/notifications', { credentials: 'include' })
        .then(response => response.json())
        .then(data => data.success && setNotifications(data.notifications))
        .catch(error => console.error('Error fetching notifications:', error));

      const socketInstance = connectSocket();
      socketInstance.on('new_notification', (data: { message: string }) => {
        setNotifications(prev => [...prev, data.message]);
      });
      return () => socketInstance.off('new_notification');
    }
  }, [isAuthenticated, user]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
    connectSocket();
  };

  const handleLogout = () => {
    fetch('http://localhost:5000/api/logout', { method: 'POST', credentials: 'include' })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setUser(null);
          setIsAuthenticated(false);
          setNotifications([]);
          setSelectedFriend(null);
          setActiveTab('chat');
          localStorage.removeItem('user');
          disconnectSocket();
        }
      })
      .catch(error => {
        console.error('Error during logout:', error);
        // Force logout even if server fails
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
        disconnectSocket();
      });
  };

  const handleRegister = () => setShowLogin(true);

  const clearNotifications = () => {
    fetch('http://localhost:5000/api/notifications', { method: 'DELETE', credentials: 'include' })
      .then(response => response.json())
      .then(data => data.success && setNotifications([]))
      .catch(error => console.error('Error clearing notifications:', error));
  };

  const handleFriendSelect = (friendUsername: string) => {
    setSelectedFriend(friendUsername);
    setActiveTab('chat');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md transform transition-all hover:scale-105 duration-300">
          {showLogin ? (
            <>
              <Login onLogin={handleLogin} />
              <p className="mt-4 text-center text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => setShowLogin(false)}
                  className="text-blue-600 font-semibold hover:text-blue-800 transition-colors duration-200"
                >
                  Register
                </button>
              </p>
            </>
          ) : (
            <>
              <Register onRegister={handleRegister} />
              <p className="mt-4 text-center text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-blue-600 font-semibold hover:text-blue-800 transition-colors duration-200"
                >
                  Login
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-lg p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center transition-transform duration-300 hover:scale-105">
            <MessageSquare className="mr-2 text-blue-500" /> Chat App
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4 flex space-x-4">
        {/* Navigation */}
        <nav className="w-16 bg-white rounded-xl shadow-lg flex flex-col items-center py-4 transition-all duration-300 hover:shadow-xl">
          <button
            onClick={() => setActiveTab('chat')}
            className={`p-3 rounded-full mb-4 transition-all duration-200 ${
              activeTab === 'chat' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200'
            }`}
            title="Chat"
          >
            <MessageSquare size={24} />
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`p-3 rounded-full mb-4 transition-all duration-200 ${
              activeTab === 'friends' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200'
            }`}
            title="Friends"
          >
            <Users size={24} />
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`p-3 rounded-full mb-4 transition-all duration-200 ${
              activeTab === 'profile' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200'
            }`}
            title="Profile"
          >
            <User size={24} />
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`p-3 rounded-full mb-4 transition-all duration-200 ${
              activeTab === 'search' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200'
            }`}
            title="Search Users"
          >
            <Search size={24} />
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`p-3 rounded-full mb-4 relative transition-all duration-200 ${
              activeTab === 'notifications' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200'
            }`}
            title="Notifications"
          >
            <Bell size={24} />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>
        </nav>

        {/* Content Area */}
        <div className="flex-grow flex space-x-4">
          {/* Friends Sidebar */}
          {activeTab === 'chat' && (
            <div className="w-64 bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-xl">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-gray-50 border-b">
                <h2 className="font-bold text-gray-700">Friends</h2>
              </div>
              <FriendsList
                username={user?.username || ''}
                onFriendSelect={handleFriendSelect}
                sidebarMode={true}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-grow bg-white rounded-xl shadow-lg p-4 transition-all duration-300 hover:shadow-xl">
            {activeTab === 'chat' && (
              <ChatRoom username={user?.username || ''} selectedFriend={selectedFriend} />
            )}
            {activeTab === 'friends' && (
              <FriendsList
                username={user?.username || ''}
                onFriendSelect={handleFriendSelect}
                sidebarMode={false}
              />
            )}
            {activeTab === 'profile' && <Profile user={user} setUser={setUser} />}
            {activeTab === 'search' && (
              <div className="text-gray-500 text-center py-10">Search Component (Coming Soon)</div>
            )}
            {activeTab === 'notifications' && <Notifications username={user?.username || ''} />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;