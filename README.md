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