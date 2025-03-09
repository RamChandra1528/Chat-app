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

const API_BASE_URL = import.meta.env.REACT_APP_API_URL || 'https://api.yourdomain.com';
const SOCKET_URL = import.meta.env.REACT_APP_SOCKET_URL || 'https://socket.yourdomain.com';

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

  const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    withCredentials: true,
  });

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      const newSocket = io(SOCKET_URL, {
        query: { userId: user.id },
        auth: { token },
        transports: ['websocket'], // Force WebSocket transport
        reconnectionAttempts: 5,
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

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

  useEffect(() => {
    if (user) {
      loadFriends();
      loadFriendRequests();
    }
  }, [user]);

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
      const response = await axiosInstance.get('/api/friends', {
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
      const response = await axiosInstance.get('/api/friends/requests', {
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
      const response = await axiosInstance.get(`/api/messages/${friendId}`, {
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
      const response = await axiosInstance.post('/api/messages', {
        receiverId: currentChat.id,
        content
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const newMessage = response.data;
      setMessages(prev => ({
        ...prev,
        [currentChat.id]: [...(prev[currentChat.id] || []), newMessage]
      }));
      socket.emit('send_message', newMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(error.response?.data?.message || 'Failed to send message');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user || !currentChat) return;
    
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.delete(`/api/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => ({
        ...prev,
        [currentChat.id]: prev[currentChat.id].filter(msg => msg.id !== messageId)
      }));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete message');
    }
  };

  const sendFriendRequest = async (userId: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Authentication required' };
    
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/friends/request', {
        receiverId: userId
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return { success: true, message: 'Friend request sent successfully!' };
    } catch (error) {
      console.error('Failed to send friend request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send friend request';
      return { success: false, message: errorMessage };
    }
  };

  const acceptFriendRequest = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axiosInstance.post(`/api/friends/accept/${userId}`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setFriendRequests(prev => prev.filter(req => req.id !== userId));
      setFriends(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      throw new Error(error.response?.data?.message || 'Failed to accept friend request');
    }
  };

  const rejectFriendRequest = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post(`/api/friends/reject/${userId}`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setFriendRequests(prev => prev.filter(req => req.id !== userId));
    } catch (error) {
      console.error('Failed to reject friend request:', error);
      throw new Error(error.response?.data?.message || 'Failed to reject friend request');
    }
  };

  const removeFriend = async (userId: string) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.delete(`/api/friends/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(prev => prev.filter(friend => friend.id !== userId));
      if (currentChat && currentChat.id === userId) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      throw new Error(error.response?.data?.message || 'Failed to remove friend');
    }
  };

  const searchUsers = async (query: string): Promise<Friend[]> => {
    if (!user || !query.trim()) return [];
    
    try {
      const token = localStorage.getItem('token');
      const response = await axiosInstance.get(`/api/users/search?q=${encodeURIComponent(query)}`, {
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