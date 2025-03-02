function sendMessage() {
    const input = document.getElementById("message");
    const msg = input.value.trim();
    if (msg) {
        socket.emit("message", { msg: msg, room: "General" });
        input.value = "";
    }
}