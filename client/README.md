# Features and Recommended Data Structures

## 1. User Registration & Login
**Data Structure:** Dictionary (Hash Map)  
**Implementation:** Python `dict` stored in `users.json`  
**Why:**
- Stores user credentials (e.g., `{ "username": { "password": "pass" } }`).
- O(1) average time complexity for lookups (e.g., checking if a username exists or verifying a password).
- **Current Use:** Using a `dict` in `users.json`, loaded/saved via `load_users()` and `save_users()`.
- **Alternative:** SQLite database (table with columns `username`, `password`) for scalability and persistence, using a B-tree index for fast lookups.

---

## 2. Real-time Messaging
**Data Structure:** List (Array) for message queue per room  
**Implementation:** Python list in memory, optionally persisted to JSON/SQLite  
**Why:**
- Messages are sequential and need to be displayed in order.
- O(1) append time for new messages.
- Easy to broadcast via Flask-SocketIO to all users in a room.
- **Current Use:** Messages are ephemeral (not stored), broadcast via WebSocket events.
- **Enhancement:** Store messages in a list per room (e.g., `{ "General": [{"user": "test", "msg": "hi", "timestamp": "..."}] }`).

---

## 3. Friend List (Graph-Based)
**Data Structure:** Graph (Adjacency List)  
**Implementation:** Python `dict` where keys are usernames and values are lists of friends (e.g., `{ "test": ["friend1", "friend2"] }`)  
**Why:**
- Represents friendships as nodes (users) and edges (relationships).
- Efficient for traversals like BFS to suggest friends-of-friends (O(V + E) time, where V is vertices and E is edges).
- **Current Use:** Not implemented yet.
- **How to Add:** Store in memory: `friends = { "test": ["friend1"], "friend1": ["test"] }`.

---

## 4. Online/Offline Status
**Data Structure:** Dictionary (Hash Map)  
**Implementation:** Python `dict` (e.g., `online_users = { "test": True, "friend1": False }`)  
**Why:**
- O(1) lookup and update for checking/setting a user’s status.
- Easily broadcast updates via SocketIO when status changes.
- **Current Use:** Using `online_users` as a `dict` in `app.py`, updated on connect/disconnect events.
- **Enhancement:** Add a last seen timestamp (e.g., `{ "test": { "online": True, "last_seen": "2025-03-02T19:00:00" } }`).

---

## 5. Search Users
**Data Structure:** Trie (Prefix Tree)  
**Implementation:** Custom Python class (e.g., `TrieNode`)  
**Why:**
- O(m) time complexity for prefix-based searches, where m is the length of the search term.
- Enables fast auto-complete suggestions (e.g., typing "te" suggests "test", "terry").
- **Current Use:** Not implemented yet.
- **How to Add:**
```python
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

trie = Trie()
for user in load_users().keys():
    trie.insert(user)
suggestions = trie.search_prefix("te")  # Returns ["test", "terry"]
```

---

## 6. Message History
**Data Structure:** List (Array) or Database Table  
**Implementation:** Python list per room in memory, persisted to JSON/SQLite  
**Why:**
- Sequential storage of messages with timestamps.
- Easy to retrieve the last n messages (e.g., slicing a list or SQL LIMIT).
- **Current Use:** Not implemented—messages are transient.
- **How to Add:**
```python
messages = { "General": [{"user": "test", "msg": "hi", "time": "2025-03-02T19:00"}] }
```

---

## 7. Typing Indicators
**Data Structure:** Dictionary (Hash Map)  
**Implementation:** Python `dict` (e.g., `typing_users = { "General": { "test": True } }`)  
**Why:**
- O(1) lookup/update to track who’s typing in each room.
- Broadcast updates via SocketIO when a user starts/stops typing.
- **Current Use:** Not implemented.
- **How to Add:**
```python
@socketio.on("typing")
def handle_typing(data):
    room = data["room"]
    typing_users.setdefault(room, {})[session["username"]] = data["is_typing"]
    emit("typing_update", {"username": session["username"], "is_typing": data["is_typing"]}, room=room, broadcast=True)
```

---

## 8. Profile Management
**Data Structure:** Dictionary (Hash Map)  
**Implementation:** Extend `users.json` (e.g., `{ "test": { "password": "123", "bio": "Hi", "avatar": "url" } }`)  
**Why:**
- O(1) access to update/retrieve profile fields.
- **Current Use:** Minimal (password only).
- **How to Add:** Add fields to the `users` dict and update `save_users()`.

---

## 9. Notification System
**Data Structure:** Queue (FIFO)  
**Implementation:** Python `collections.deque` per user (e.g., `notifications = { "test": deque(["New message from friend1"]) }`)  
**Why:**
- O(1) append/pop for adding and processing notifications.
- Ensures notifications are delivered in order.
- **Current Use:** Not implemented.

---

## 10. Responsive Design
**Data Structure:** N/A (Frontend/CSS concern)  
**Implementation:** Use CSS Flexbox/Grid, no backend data structure needed.  
**Why:** Layout management is handled by the browser, not a data structure.

---

## Summary of Data Structures

| Feature              | Data Structure      | Why                  | Current Status  |
|----------------------|--------------------|----------------------|-----------------|
| Registration/Login   | Dictionary         | Fast lookups         | Implemented     |
| Real-time Messaging  | List               | Sequential storage   | Partially       |
| Friend List          | Graph (Adjacency)  | Relationship graph   | Not implemented |
| Online/Offline       | Dictionary         | Fast status updates  | Implemented     |
| Search Users         | Trie               | Prefix search        | Not implemented |
| Message History      | List/Database      | Ordered history      | Not implemented |
| Typing Indicators    | Dictionary         | Track typing status  | Not implemented |
| Profile Management   | Dictionary         | Fast field access    | Partially       |
| Notifications        | Queue (Deque)      | Ordered delivery     | Not implemented |

Let’s enhance your app further! 🚀



# Simple Real-time Chat App

A lightweight, real-time chat application built with Flask, Flask-SocketIO, and vanilla JavaScript. This app allows users to register, log in, chat in a "General" room, and see online/offline statuses. It’s designed as a foundation for additional features like friend lists, search, and message history.

### Features
- **User Registration & Login:** Sign up and log in with a username and password.
- **Real-time Messaging:** Send and receive messages instantly in the "General" chat room.
- **Online/Offline Status:** See which users are currently online (green) or offline (grey).
- **Responsive Design:** Basic styling with CSS for a clean interface.

### Tech Stack
- **Backend:** Flask (Python), Flask-SocketIO for WebSocket support
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Real-time:** Socket.IO (v4.0.1 via CDN)
- **Storage:** JSON file (`users.json`) for user data

### Project Structure
```
simple_chat_app/
├── static/
│   ├── css/
│   │   └── style.css       # Styling for the app
│   └── js/
│       └── script.js       # Client-side logic (e.g., sending messages)
├── templates/
│   ├── login.html          # Login page
│   ├── register.html       # Registration page
│   └── chat.html           # Chat interface
├── app.py                  # Main Flask application
├── users.json              # User data storage
└── README.md               # This file
```

### Setup Instructions

#### Prerequisites
- Python 3.x
- `pip` (Python package manager)

#### Installation

**Clone or Create the Project Directory**
- If cloning from a repo: `git clone <repo-url>`
- Otherwise, create the folder structure above and add the files.

**Set Up a Virtual Environment**
```powershell
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

**Install Dependencies**
```powershell
pip install flask flask-socketio eventlet
```

**Initialize `users.json`**
Create an empty `users.json` file in the root directory with:
```json
{}
```

**Run the App**
```powershell
python app.py
```
Open your browser to [http://127.0.0.1:5000](http://127.0.0.1:5000).

### Usage
- **Register:** Go to `/register`, enter a username and password.
- **Login:** Use your credentials at `/login`.
- **Chat:** Send messages in the "General" room and see online users.

### Data Structures Used

- **User Registration/Login:**
  - Dictionary (`dict` in `users.json`): O(1) lookups for username/password checks.
- **Real-time Messaging:**
  - Transient Event Stream: Messages are broadcast via SocketIO (no persistent storage yet).
- **Online/Offline Status:**
  - Dictionary (`online_users` in `app.py`): O(1) updates for status tracking.

### Planned Enhancements

Based on the original feature list, here are potential upgrades with suitable data structures:

- **Friend List**
  - **Graph (Adjacency List):** `dict` of users and their friends for BFS-based suggestions.
- **Search Users**
  - **Trie:** Prefix tree for fast auto-complete username search.
- **Message History**
  - **List or SQLite Table:** Store messages per room with timestamps.
- **Typing Indicators**
  - **Dictionary:** Track who’s typing per room (`dict` of rooms to users).
- **Profile Management**
  - **Dictionary:** Extend user data with bio, avatar, etc.
- **Notification System**
  - **Queue (Deque):** Ordered notifications per user.
- **Responsive Design**
  - Enhanced with CSS Flexbox/Grid (no data structure needed).

### Contributing

Feel free to fork this project, add features, and submit pull requests. Focus areas:

- Implement missing features from the list above.
- Improve security (e.g., hash passwords with bcrypt).
- Optimize performance for larger user bases.

### Troubleshooting

- **404 Errors for Static Files:** Ensure `style.css` and `script.js` are in `static/css/` and `static/js/`, respectively.
- **JSONDecodeError:** Verify `users.json` contains valid JSON (e.g., `{}`).
- **WebSocket Issues:** Check browser console for Socket.IO errors and ensure `eventlet` is installed.

### License

This project is open-source and available under the MIT License.

---

**How to Add to Your Project**

1. Open a text editor (e.g., VS Code, Notepad).
2. Copy the content above.
3. Save it as `README.md` in `C:\Users\iitje\OneDrive\Desktop\simple_chat_app\`.

If you use Git, commit it:
```powershell
git add README.md
git commit -m "Add initial project README"
```

