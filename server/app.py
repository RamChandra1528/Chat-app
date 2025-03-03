from flask import Flask, request, session, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import json
import os
from collections import deque
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, resources={r"/*": {
    "origins": "http://localhost:5173",  # Specific frontend origin
    "supports_credentials": True         # Allow credentials (cookies/session)
}})
socketio = SocketIO(app, cors_allowed_origins="http://localhost:5173")  # Match CORS for SocketIO

# Data structures
users = {}  # Dictionary for user credentials
online_users = {}  # Dictionary for online/offline status
messages = {}  # Dictionary for message history per room (public and private)
typing_users = {}  # Dictionary for typing indicators
friends = {}  # Graph (adjacency list) for friend relationships
notifications = {}  # Queue for notifications per user

# Default public rooms
DEFAULT_ROOMS = ["General", "Technology", "Random"]
for room in DEFAULT_ROOMS:
    messages[room] = []

# Trie for user search
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()
    
    def insert(self, word):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_end = True
    
    def search_prefix(self, prefix):
        node = self.root
        for char in prefix:
            if char not in node.children:
                return []
            node = node.children[char]
        return self._collect_words(node, prefix)

    def _collect_words(self, node, prefix):
        results = []
        if node.is_end:
            results.append(prefix)
        for char, child in node.children.items():
            results.extend(self._collect_words(child, prefix + char))
        return results

user_trie = Trie()

# File operations
def load_users():
    if os.path.exists('users.json'):
        with open('users.json', 'r') as f:
            return json.load(f)
    return {}

def save_users():
    with open('users.json', 'w') as f:
        json.dump(users, f)

# Load users on startup
users = load_users()
for username in users:
    user_trie.insert(username)
    friends.setdefault(username, [])
    notifications.setdefault(username, deque())

# Helper function to generate private room name between two friends
def get_private_room_name(user1, user2):
    # Sort usernames to ensure consistent room name (e.g., "alice_bob" or "bob_alice" becomes "alice_bob")
    return '_'.join(sorted([user1, user2]))

# Graph Utility Functions (New Features)
def are_connected(username1, username2):
    """Check if two users are connected (directly or indirectly) using BFS."""
    if username1 not in friends or username2 not in friends:
        return False
    if username2 in friends[username1]:
        return True  # Direct friends
    
    visited = set()
    queue = deque([username1])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        for neighbor in friends.get(current, []):
            if neighbor == username2:
                return True  # Indirect connection found
            if neighbor not in visited:
                queue.append(neighbor)
    return False

def shortest_path(username1, username2):
    """Find the shortest path between two users using BFS."""
    if username1 not in friends or username2 not in friends:
        return []
    if username1 == username2:
        return [username1]
    
    visited = set()
    parent = {}
    queue = deque([username1])
    visited.add(username1)
    
    while queue:
        current = queue.popleft()
        for neighbor in friends.get(current, []):
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = current
                queue.append(neighbor)
                if neighbor == username2:
                    # Reconstruct path
                    path = []
                    while neighbor in parent:
                        path.append(neighbor)
                        neighbor = parent[neighbor]
                    path.append(username1)
                    return path[::-1]  # Reverse to get start -> end
    return []  # No path exists

def suggest_friends(username):
    """Suggest friends (friends-of-friends not already friends)."""
    if username not in friends:
        return []
    
    suggestions = set()
    current_friends = set(friends[username])
    
    # Get friends-of-friends
    for friend in current_friends:
        for fof in friends.get(friend, []):
            if fof != username and fof not in current_friends:
                suggestions.add(fof)
    
    return list(suggestions)

@app.route("/")
def Home():
    return "Successfully work Backend"

# Routes
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    if username in users:
        return jsonify({"success": False, "message": "Username already exists"}), 400
    
    users[username] = {
        "password": password,
        "bio": "",
        "avatar": ""
    }
    friends[username] = []  # Initialize graph node
    notifications[username] = deque()
    user_trie.insert(username)
    save_users()
    
    return jsonify({"success": True, "message": "Registration successful"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    if username not in users or users[username]["password"] != password:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401
    
    session['username'] = username
    online_users[username] = True
    
    return jsonify({
        "success": True, 
        "message": "Login successful",
        "user": {
            "username": username,
            "bio": users[username].get("bio", ""),
            "avatar": users[username].get("avatar", "")
        }
    }), 200

@app.route('/api/logout', methods=['POST'])
def logout():
    username = session.get('username')
    if username:
        online_users[username] = False
        session.pop('username', None)
    return jsonify({"success": True, "message": "Logout successful"}), 200

@app.route('/api/search', methods=['GET'])
def search_users():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify({"users": []}), 200
    
    results = user_trie.search_prefix(query)
    return jsonify({"users": results}), 200

@app.route('/api/profile', methods=['GET', 'PUT'])
def profile():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    if request.method == 'GET':
        return jsonify({
            "success": True,
            "user": {
                "username": username,
                "bio": users[username].get("bio", ""),
                "avatar": users[username].get("avatar", "")
            }
        }), 200
    
    if request.method == 'PUT':
        data = request.json
        users[username]["bio"] = data.get('bio', users[username].get("bio", ""))
        users[username]["avatar"] = data.get('avatar', users[username].get("avatar", ""))
        save_users()
        return jsonify({"success": True, "message": "Profile updated"}), 200

@app.route('/api/friends', methods=['GET', 'POST', 'DELETE'])
def manage_friends():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    if request.method == 'GET':
        friend_list = friends.get(username, [])
        friend_data = []
        for friend in friend_list:
            friend_data.append({
                "username": friend,
                "online": online_users.get(friend, False),
                "bio": users.get(friend, {}).get("bio", ""),
                "avatar": users.get(friend, {}).get("avatar", "")
            })
        return jsonify({"success": True, "friends": friend_data}), 200
    
    if request.method == 'POST':
        data = request.json
        friend_username = data.get('username')
        
        if not friend_username or friend_username not in users:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        if friend_username == username:
            return jsonify({"success": False, "message": "Cannot add yourself as friend"}), 400
        
        if friend_username in friends.get(username, []):
            return jsonify({"success": False, "message": "Already friends"}), 400
        
        friends.setdefault(username, []).append(friend_username)
        friends.setdefault(friend_username, []).append(username)
        
        # Add notification for the friend
        notifications.setdefault(friend_username, deque()).append(f"{username} added you as a friend")
        
        return jsonify({"success": True, "message": "Friend added"}), 201
    
    if request.method == 'DELETE':
        data = request.json
        friend_username = data.get('username')
        
        if not friend_username or friend_username not in friends.get(username, []):
            return jsonify({"success": False, "message": "Friend not found"}), 404
        
        friends[username].remove(friend_username)
        if username in friends.get(friend_username, []):
            friends[friend_username].remove(username)
        
        return jsonify({"success": True, "message": "Friend removed"}), 200

@app.route('/api/notifications', methods=['GET', 'DELETE'])
def manage_notifications():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    if request.method == 'GET':
        user_notifications = list(notifications.get(username, deque()))
        return jsonify({"success": True, "notifications": user_notifications}), 200
    
    if request.method == 'DELETE':
        notifications[username] = deque()
        return jsonify({"success": True, "message": "Notifications cleared"}), 200

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    return jsonify({"success": True, "rooms": DEFAULT_ROOMS}), 200

# New Graph-Related Routes
@app.route('/api/friends/connected', methods=['GET'])
def check_connected():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    target = request.args.get('target')
    if not target or target not in users:
        return jsonify({"success": False, "message": "Target user not found"}), 404
    
    connected = are_connected(username, target)
    return jsonify({"success": True, "connected": connected}), 200

@app.route('/api/friends/path', methods=['GET'])
def get_shortest_path():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    target = request.args.get('target')
    if not target or target not in users:
        return jsonify({"success": False, "message": "Target user not found"}), 404
    
    path = shortest_path(username, target)
    return jsonify({"success": True, "path": path}), 200

@app.route('/api/friends/suggestions', methods=['GET'])
def get_friend_suggestions():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    suggestions = suggest_friends(username)
    suggestion_data = [
        {"username": user, "bio": users[user].get("bio", ""), "avatar": users[user].get("avatar", "")}
        for user in suggestions
    ]
    return jsonify({"success": True, "suggestions": suggestion_data}), 200

# Socket events
@socketio.on('connect')
def handle_connect():
    username = session.get('username')
    if username:
        online_users[username] = True
        emit('user_status', {'username': username, 'online': True}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    username = session.get('username')
    if username:
        online_users[username] = False
        emit('user_status', {'username': username, 'online': False}, broadcast=True)

@socketio.on('join')
def handle_join(data):
    username = session.get('username')
    if not username:
        return
    
    room = data.get('room')
    friend = data.get('friend')  # Optional: friend username for private chat
    
    if friend and friend in friends.get(username, []):
        # Private chat room between two friends
        room = get_private_room_name(username, friend)
        messages.setdefault(room, [])  # Initialize message history if not exists
    
    if room:
        join_room(room)
        room_messages = messages.get(room, [])[-50:]  # Last 50 messages
        emit('message_history', {'messages': room_messages})
        emit('user_joined', {'username': username, 'room': room}, room=room, broadcast=True)

@socketio.on('leave')
def handle_leave(data):
    username = session.get('username')
    if not username:
        return
    
    room = data.get('room')
    friend = data.get('friend')
    
    if friend and friend in friends.get(username, []):
        room = get_private_room_name(username, friend)
    
    if room:
        leave_room(room)
        emit('user_left', {'username': username, 'room': room}, room=room, broadcast=True)

@socketio.on('message')
def handle_message(data):
    username = session.get('username')
    if not username:
        return
    
    room = data.get('room')
    friend = data.get('friend')  # Optional: friend username for private chat
    message = data.get('message')
    
    if friend and friend in friends.get(username, []):
        room = get_private_room_name(username, friend)
        messages.setdefault(room, [])  # Ensure room exists
    
    if not room or not message:
        return
    
    timestamp = datetime.now().isoformat()
    message_data = {
        'username': username,
        'message': message,
        'timestamp': timestamp
    }
    
    # Store message in history
    messages.setdefault(room, []).append(message_data)
    # Keep only last 100 messages per room
    if len(messages[room]) > 100:
        messages[room] = messages[room][-100:]
    
    emit('new_message', message_data, room=room, broadcast=True)

@socketio.on('typing')
def handle_typing(data):
    username = session.get('username')
    if not username:
        return
    
    room = data.get('room')
    friend = data.get('friend')
    is_typing = data.get('typing', False)
    
    if friend and friend in friends.get(username, []):
        room = get_private_room_name(username, friend)
    
    if not room:
        return
    
    typing_users.setdefault(room, {})[username] = is_typing
    emit('typing_update', {'username': username, 'typing': is_typing}, room=room, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0')