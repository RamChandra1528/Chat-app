import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Friend {
  id: string;
  username: string;
  profilePic: string;
  status: 'online' | 'offline';
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
}

interface ChatContextType {
  friends: Friend[];
  friendRequests: Friend[];
  messages: Record<string, Message[]>;
  currentChat: Friend | null;
  loadingFriends: boolean;
  loadingMessages: boolean;
  setCurrentChat: (friend: Friend) => void;
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendFriendRequest: (userId: string) => Promise<{ success: boolean; message: string }>;
  acceptFriendRequest: (userId: string) => Promise<void>;
  rejectFriendRequest: (userId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Friend[]>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [currentChat, setCurrentChat] = useState<Friend | null>(null);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000', {
        query: { userId: user.id }
      });
      
      setSocket(newSocket);
      
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('message', (message: Message) => {
      setMessages(prev => {
        const chatId = message.senderId === user?.id ? message.receiverId : message.senderId;
        return {
          ...prev,
          [chatId]: [...(prev[chatId] || []), message]
        };
      });
    });

    socket.on('friend_request', (request: Friend) => {
      setFriendRequests(prev => [...prev, request]);
    });

    socket.on('friend_status', ({ userId, status }: { userId: string, status: 'online' | 'offline' }) => {
      setFriends(prev => 
        prev.map(friend => 
          friend.id === userId ? { ...friend, status } : friend
        )
      );
    });

    return () => {
      socket.off('message');
      socket.off('friend_request');
      socket.off('friend_status');
    };
  }, [socket, user]);

  // Load friends and friend requests
  useEffect(() => {
    if (user) {
      loadFriends();
      loadFriendRequests();
    }
  }, [user]);

  // Load messages when current chat changes
  useEffect(() => {
    if (currentChat) {
      loadMessages(currentChat.id);
    }
  }, [currentChat]);

  const loadFriends = async () => {
    if (!user) return;
    
    setLoadingFriends(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriendRequests(response.data);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  };

  const loadMessages = async (friendId: string) => {
    if (!user) return;
    
    setLoadingMessages(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/messages/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessages(prev => ({
        ...prev,
        [friendId]: response.data
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || !currentChat || !socket) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/messages', {
        receiverId: currentChat.id,
        content
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newMessage = response.data;
      
      // Update local state
      setMessages(prev => ({
        ...prev,
        [currentChat.id]: [...(prev[currentChat.id] || []), newMessage]
      }));
      
      // Send through socket
      socket.emit('send_message', newMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user || !currentChat) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setMessages(prev => ({
        ...prev,
        [currentChat.id]: prev[currentChat.id].filter(msg => msg.id !== messageId)
      }));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw new Error('Failed to delete message');
    }
  };

  const sendFriendRequest = async (userId: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'You must be logged in to send friend requests' };
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/friends/request', {
        receiverId: userId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return { success: true, message: 'Friend request sent successfully!' };
    } catch (error: any) {
      console.error('Failed to send friend request:', error);
      
      // Handle specific error cases
      if (error.response) {
        if (error.response.status === 409) {
          // 409 Conflict - Already friends or request already sent
          return { 
            success: false, 
            message: error.response.data.message || 'You are already friends or have already sent a request to this user'
          };
        }
      }
      
      return { success: false, message: 'Failed to send friend request. Please try again later.' };
    }
  };

  const acceptFriendRequest = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:5000/api/friends/accept/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setFriendRequests(prev => prev.filter(req => req.id !== userId));
      setFriends(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      throw new Error('Failed to accept friend request');
    }
  };

  const rejectFriendRequest = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/friends/reject/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setFriendRequests(prev => prev.filter(req => req.id !== userId));
    } catch (error) {
      console.error('Failed to reject friend request:', error);
      throw new Error('Failed to reject friend request');
    }
  };

  const removeFriend = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/friends/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setFriends(prev => prev.filter(friend => friend.id !== userId));
      
      // If the removed friend was the current chat, clear it
      if (currentChat && currentChat.id === userId) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      throw new Error('Failed to remove friend');
    }
  };

  const searchUsers = async (query: string): Promise<Friend[]> => {
    if (!user || !query.trim()) return [];
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/users/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  };

  return (
    <ChatContext.Provider value={{
      friends,
      friendRequests,
      messages,
      currentChat,
      loadingFriends,
      loadingMessages,
      setCurrentChat,
      sendMessage,
      deleteMessage,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      searchUsers
    }}>
      {children}
    </ChatContext.Provider>
  );
};