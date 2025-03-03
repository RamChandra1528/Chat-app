import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

type User = {
  username: string;
  bio: string;
  avatar: string;
};

type ProfileProps = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const Profile: React.FC<ProfileProps> = ({ user, setUser }) => {
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync local state with user prop when it changes
  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bio, avatar }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      if (data.success) {
        setSuccess('Profile updated successfully');
        if (user) {
          const updatedUser = { ...user, bio, avatar };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Profile update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center text-gray-500 py-10">
        Please log in to view your profile.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Your Profile</h2>

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

      <div className="mb-6 flex flex-col items-center">
        {avatar ? (
          <img
            src={avatar}
            alt="Avatar"
            className="w-24 h-24 rounded-full mb-2 object-cover"
            onError={() => setAvatar('')} // Fallback to initial if image fails
          />
        ) : (
          <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-4xl font-bold mb-2">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="font-bold text-xl">{user.username}</div>
        {bio && <div className="text-gray-600 text-sm mt-1 text-center">{bio}</div>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="bio" className="block text-gray-700 text-sm font-bold mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
            rows={4}
            placeholder="Tell us about yourself"
            disabled={isLoading}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="avatar" className="block text-gray-700 text-sm font-bold mb-2">
            Avatar URL (optional)
          </label>
          <input
            type="text"
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
            placeholder="https://example.com/avatar.jpg"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-center">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center disabled:bg-blue-300"
            disabled={isLoading || (bio === user.bio && avatar === user.avatar)} // Disable if no changes
          >
            <Save size={18} className="mr-2" />
            {isLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;