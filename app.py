from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os

app = Flask(__name__)
app.secret_key = "supersecretkey"
socketio = SocketIO(app)

USER_FILE = "users.json"
if not os.path.exists(USER_FILE):
    with open(USER_FILE, "w") as f:
        json.dump({}, f)

def load_users():
    try:
        with open(USER_FILE, "r") as f:
            content = f.read().strip()
            if not content:
                return {}
            return json.loads(content)
    except (json.JSONDecodeError, FileNotFoundError):
        return {}

def save_users(users):
    with open(USER_FILE, "w") as f:
        json.dump(users, f)

online_users = {}

@app.route("/")
def index():
    if "username" in session:
        return redirect(url_for("chat"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        users = load_users()
        if username in users and users[username]["password"] == password:
            session["username"] = username
            return redirect(url_for("chat"))
        return "Invalid credentials"
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        users = load_users()
        if username in users:
            return "Username taken"
        users[username] = {"password": password}
        save_users(users)
        return redirect(url_for("login"))
    return render_template("register.html")

@app.route("/chat")
def chat():
    if "username" not in session:
        return redirect(url_for("login"))
    return render_template("chat.html", username=session["username"])

@app.route("/logout")
def logout():
    session.pop("username", None)
    return redirect(url_for("login"))

@socketio.on("connect")
def handle_connect():
    if "username" in session:
        online_users[session["username"]] = True
        emit("status_update", {"username": session["username"], "online": True}, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    if "username" in session:
        online_users[session["username"]] = False
        emit("status_update", {"username": session["username"], "online": False}, broadcast=True)

@socketio.on("join")
def on_join(data):
    room = data["room"]
    join_room(room)
    emit("message", {"msg": f"{session['username']} has joined the room.", "user": "System"}, room=room)

@socketio.on("message")
def handle_message(data):
    room = data["room"]
    msg = data["msg"]
    emit("message", {"msg": msg, "user": session["username"]}, room=room)

if __name__ == "__main__":
    socketio.run(app, debug=True)