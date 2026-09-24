// 🟢 AAPKA RENDER WALA LIVE SERVER LINK YAHAN HAI
const API_URL = 'https://skyway-messenger.onrender.com';

// Updated Socket Connection (Live message ke liye zaroori)
const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: false
});

let currentUser = '';
let chatWithUser = '';

// --- BUTTONS KO CONNECT KARNA ---
document.getElementById('signup-btn').addEventListener('click', signup);
document.getElementById('login-btn').addEventListener('click', login);
document.getElementById('chat-btn').addEventListener('click', startChat);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('logout-btn').addEventListener('click', logout);

// Enter key dabane par message bhejna
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});


// --- AUTHENTICATION FUNCTIONS ---

async function signup() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Username aur Password dono daalein!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        document.getElementById('auth-message').innerText = data.message || data.error;
    } catch (error) {
        document.getElementById('auth-message').innerText = "Server se connect nahi ho pa raha!";
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Username aur Password dono daalein!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.token) {
            currentUser = data.username;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', currentUser);
            showChatScreen();
        } else {
            document.getElementById('auth-message').innerText = data.error;
        }
    } catch (error) {
        document.getElementById('auth-message').innerText = "Server se connect nahi ho pa raha!";
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.reload();
}

function showChatScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('my-username').innerText = `Logged in as: ${currentUser}`;
    socket.emit('join', currentUser);
}


// --- CHAT FUNCTIONS ---

async function startChat() {
    const user = document.getElementById('search-user').value.trim();
    if (user === currentUser) {
        alert('Aap khud se chat nahi kar sakte!');
        return;
    }
    if (!user) {
        alert('Username daalein!');
        return;
    }

    chatWithUser = user;
    document.getElementById('chat-with').innerText = `Chatting with: ${chatWithUser}`;
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

    // Purane messages load karein
    try {
        const res = await fetch(`${API_URL}/api/messages/${currentUser}/${chatWithUser}`);
        const messages = await res.json();
        
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = ''; // Clear previous chat
        
        messages.forEach(msg => {
            const type = msg.sender === currentUser ? 'sent' : 'received';
            appendMessage(msg.sender, msg.text, type);
        });
    } catch (error) {
        console.log("Messages load nahi ho paye.");
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !chatWithUser) return;

    socket.emit('sendPrivateMessage', {
        sender: currentUser,
        receiver: chatWithUser,
        text: text
    });
    input.value = '';
}

// Naya message receive karna
socket.on('receivePrivateMessage', (data) => {
    if ((data.sender === currentUser && data.receiver === chatWithUser) || 
        (data.sender === chatWithUser && data.receiver === currentUser)) {
        
        const type = data.sender === currentUser ? 'sent' : 'received';
        appendMessage(data.sender, data.text, type);
    } 
});

// Message ko screen par dikhana
function appendMessage(sender, text, type) {
    const messagesDiv = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = `<b>${sender}:</b> ${text}`;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto scroll to bottom
}

// --- AUTO LOGIN (Agar pehle se login hai) ---
window.onload = () => {
    const savedUser = localStorage.getItem('username');
    if (savedUser) {
        currentUser = savedUser;
        showChatScreen();
    }
};