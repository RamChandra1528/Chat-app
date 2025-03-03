import React, { useState, useEffect } from 'react';
import { UserPlus, X, MessageSquare } from 'lucide-react';

type Friend = {
  username: string;
  online: boolean;
  bio: string;
  avatar: string;
};

type FriendsListProps = {
  username: string;
  onFriendSelect?: (friendUsername: string) => void;
  sidebarMode?: boolean;
};

const FriendsList: React.FC<FriendsListProps> = ({
  username,
  onFriendSelect,
  sidebarMode = false,
}) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, [username]); // Add username as dependency to refetch if it changes

  const fetchFriends = () => {
    setIsLoading(true);
    fetch('http://localhost:5000/api/friends', {
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch friends');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setFriends(data.friends);
        } else {
          setError(data.message || 'Failed to load friends');
        }
      })
      .catch(error => {
        console.error('Error fetching friends:', error);
        setError('Network error. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newFriend.trim()) {
      setError('Please enter a username');
      return;
    }

    if (newFriend === username) {
      setError("You can't add yourself as a friend");
      return;
    }

    if (friends.some(friend => friend.username === newFriend)) {
      setError('This user is already your friend');
      return;
    }

    setIsLoading(true);
    fetch('http://localhost:5000/api/friends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: newFriend }),
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to add friend');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setSuccess(`${newFriend} added as a friend`);
          setNewFriend('');
          fetchFriends();
        } else {
          setError(data.message || 'Failed to add friend');
        }
      })
      .catch(error => {
        console.error('Error adding friend:', error);
        setError('Network error. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  const handleRemoveFriend = (friendUsername: string) => {
    if (window.confirm(`Are you sure you want to remove ${friendUsername} from your friends?`)) {
      setIsLoading(true);
      fetch('http://localhost:5000/api/friends', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: friendUsername }),
        credentials: 'include',
      })
      .then(response => {
        if (!response.ok) throw new Error('Failed to remove friend');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setFriends(friends.filter(friend => friend.username !== friendUsername));
          setSuccess(`${friendUsername} removed from friends`);
          if (onFriendSelect && friendUsername === newFriend) {
            onFriendSelect(''); // Clear selection if removed friend was selected
          }
        } else {
          setError(data.message || 'Failed to remove friend');
        }
      })
      .catch(error => {
        console.error('Error removing friend:', error);
        setError('Network error. Please try again.');
      })
      .finally(() => setIsLoading(false));
    }
  };

  const handleFriendClick = (friendUsername: string) => {
    if (onFriendSelect) {
      onFriendSelect(friendUsername);
    }
  };

  // Sidebar mode rendering
  if (sidebarMode) {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        {isLoading && friends.length === 0 ? (
          <div className="text-center text-gray-500 py-4">Loading friends...</div>
        ) : friends.length === 0 ? (
          <div className="text-center text-gray-500 py-4 px-2">
            No friends yet. Add friends in the Friends tab.
          </div>
        ) : (
          <ul className="space-y-1 p-2">
            {friends.map(friend => (
              <li
                key={friend.username}
                className="p-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
                onClick={() => handleFriendClick(friend.username)}
              >
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                        friend.online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></span>
                  </div>
                  <div className="ml-2 flex-grow truncate">
                    <div className="font-medium text-sm">{friend.username}</div>
                    <div className="text-xs text-gray-500">
                      {friend.online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Full friends list mode
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-4">Friends</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleAddFriend} className="mb-6 flex">
        <input
          type="text"
          value={newFriend}
          onChange={(e) => setNewFriend(e.target.value)}
          placeholder="Add friend by username"
          className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 flex items-center disabled:bg-blue-300"
          disabled={isLoading || !newFriend.trim()}
        >
          <UserPlus size={20} className="mr-1" /> Add
        </button>
      </form>

      <div className="flex-grow overflow-y-auto">
        {isLoading && friends.length === 0 ? (
          <div className="text-center text-gray-500 py-4">Loading friends...</div>
        ) : friends.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No friends yet. Add some friends to chat with!
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map(friend => (
              <li
                key={friend.username}
                className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${
                        friend.online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></span>
                  </div>
                  <div className="ml-3">
                    <div className="font-medium">{friend.username}</div>
                    <div className="text-sm text-gray-500">
                      {friend.online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleFriendClick(friend.username)}
                    className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-gray-200"
                    title="Chat with friend"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button
                    onClick={() => handleRemoveFriend(friend.username)}
                    className="text-gray-500 hover:text-red-500 p-2 rounded-full hover:bg-gray-200"
                    title="Remove friend"
                    disabled={isLoading}
                  >
                    <X size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FriendsList;