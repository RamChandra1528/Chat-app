import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { connectSocket, getSocket } from '../socket';

type Message = {
  username: string;
  message: string;
  timestamp: string;
};

type ChatRoomProps = {
  username: string;
  selectedFriend: string | null;
};

const MAX_MESSAGES = 100;

const ChatRoom: React.FC<ChatRoomProps> = ({ username, selectedFriend }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [friendSuggestions, setFriendSuggestions] = useState<{ username: string; bio: string; avatar: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [directChatMode, setDirectChatMode] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch rooms
    fetch('http://localhost:5000/api/rooms', { credentials: 'include' })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch rooms');
        return response.json();
      })
      .then(data => {
        if (data.success && data.rooms.length > 0) {
          setRooms(data.rooms);
          if (!selectedFriend && !currentRoom) {
            setCurrentRoom(data.rooms[0]);
            setDirectChatMode(false);
          }
        }
      })
      .catch(error => console.error('Error fetching rooms:', error));

    // Fetch friend suggestions when not in direct chat
    if (!selectedFriend) {
      fetch('http://localhost:5000/api/friends/suggestions', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          if (data.success) setFriendSuggestions(data.suggestions);
        })
        .catch(error => console.error('Error fetching friend suggestions:', error));
    }

    const socketInstance = connectSocket();
    socketInstance.on('message_history', (data: { messages: Message[] }) => {
      setMessages(prev => [...prev, ...data.messages].slice(-MAX_MESSAGES));
      scrollToBottom();
    });
    socketInstance.on('new_message', (data: Message) => {
      setMessages(prev => [...prev, data].slice(-MAX_MESSAGES));
      scrollToBottom();
    });
    socketInstance.on('typing_update', (data: { username: string; typing: boolean }) => {
      if (data.username !== username) {
        setTypingUsers(prev => ({ ...prev, [data.username]: data.typing }));
      }
    });

    return () => {
      socketInstance.off('message_history');
      socketInstance.off('new_message');
      socketInstance.off('typing_update');
    };
  }, [username, selectedFriend]);

  useEffect(() => {
    const socketInstance = getSocket();
    if (!socketInstance) return;

    if (selectedFriend) {
      setDirectChatMode(true);
      setCurrentRoom('');
      socketInstance.emit('join', { friend: selectedFriend });
    } else if (rooms.length > 0 && !currentRoom && !directChatMode) {
      setCurrentRoom(rooms[0]);
      setDirectChatMode(false);
      socketInstance.emit('join', { room: rooms[0] });
    } else if (currentRoom) {
      socketInstance.emit('join', { room: currentRoom });
    }

    return () => {
      if (selectedFriend) socketInstance.emit('leave', { friend: selectedFriend });
      else if (currentRoom) socketInstance.emit('leave', { room: currentRoom });
    };
  }, [selectedFriend, currentRoom, rooms, username, directChatMode]);

  useEffect(() => scrollToBottom(), [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const socketInstance = getSocket();
    if (!socketInstance || !message.trim()) return;

    if (directChatMode && selectedFriend) {
      socketInstance.emit('message', { friend: selectedFriend, message });
    } else if (currentRoom) {
      socketInstance.emit('message', { room: currentRoom, message });
    }
    setMessage('');
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketInstance.emit('typing', {
      room: directChatMode ? undefined : currentRoom,
      friend: directChatMode ? selectedFriend : undefined,
      typing: false,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const socketInstance = getSocket();
    if (!socketInstance) return;

    setMessage(e.target.value);

    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      socketInstance.emit('typing', {
        room: directChatMode ? undefined : currentRoom,
        friend: directChatMode ? selectedFriend : undefined,
        typing: true,
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socketInstance.emit('typing', {
          room: directChatMode ? undefined : currentRoom,
          friend: directChatMode ? selectedFriend : undefined,
          typing: false,
        });
      }
    }, 2000);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const typingUsersText = () => {
    const users = Object.keys(typingUsers).filter(user => typingUsers[user]);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return 'Several people are typing...';
  };

  const getChatTitle = () => {
    if (directChatMode && selectedFriend) return `Chat with ${selectedFriend}`;
    return currentRoom || 'Chat Rooms';
  };

  return (
    <div className="h-screen flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">{getChatTitle()}</h2>
      </div>

      {/* Room Tabs (for public rooms) */}
      {!directChatMode && rooms.length > 0 && (
        <div className="flex space-x-2 p-4 border-b border-gray-200 bg-gray-50 overflow-x-auto flex-shrink-0">
          {rooms.map(room => (
            <button
              key={room}
              onClick={() => {
                setCurrentRoom(room);
                setDirectChatMode(false);
              }}
              className={`px-4 py-2 rounded-full font-medium text-sm transition-colors duration-200 shrink-0 ${
                currentRoom === room && !directChatMode
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {room}
            </button>
          ))}
        </div>
      )}

      {/* Friend Suggestions (only in public room mode) */}
      {!directChatMode && friendSuggestions.length > 0 && (
        <div className="p-4 bg-gray-100 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Friend Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {friendSuggestions.map(suggestion => (
              <div
                key={suggestion.username}
                className="px-3 py-1 bg-white rounded-full text-sm text-gray-800 shadow-sm"
              >
                {suggestion.username}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-grow overflow-y-auto p-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            {directChatMode
              ? `Start a conversation with ${selectedFriend}!`
              : 'No messages yet. Start the conversation!'}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                msg.username === username ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
                  msg.username === username
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                {msg.username !== username && (
                  <div className="font-semibold text-sm text-gray-600">{msg.username}</div>
                )}
                <div className="text-sm break-words">{msg.message}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <div className="px-4 py-2 text-sm text-gray-600 italic bg-gray-50 border-t border-gray-200 flex-shrink-0">
        {typingUsersText()}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="flex items-center p-4 bg-white border-t border-gray-200 flex-shrink-0"
      >
        <input
          type="text"
          value={message}
          onChange={handleInputChange}
          placeholder={
            directChatMode ? `Message ${selectedFriend}...` : 'Type a message...'
          }
          className="flex-grow px-4 py-2 border border-gray-300 rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed"
          disabled={!getSocket()}
        />
        <button
          type="submit"
          className="p-2 bg-blue-600 text-white rounded-r-full hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200"
          disabled={!message.trim() || !getSocket()}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;