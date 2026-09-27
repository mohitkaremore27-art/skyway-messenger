// Render Backend Live URL Connected
const SOCKET_URL = 'https://skyway-messenger.onrender.com';
const socket = io(SOCKET_URL);

let currentUser = localStorage.getItem('skyway_user') || null;
let currentChatUser = null;
let activeUsersList = [];

window.onload = () => {
    if (currentUser) {
        showChatApp();
    }
};

function switchTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const authBtn = document.getElementById('auth-btn');
    const errorMsg = document.getElementById('auth-error');
    errorMsg.innerText = '';

    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        authBtn.innerText = 'Login';
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        authBtn.innerText = 'Signup';
    }
}

async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error');
    const isLogin = document.getElementById('tab-login').classList.contains('active');

    if (!username || !password) {
        errorMsg.innerText = 'Sabhi fields bharna zaroori hai!';
        return;
    }

    const endpoint = isLogin ? '/api/login' : '/api/signup';

    try {
        const response = await fetch(`${SOCKET_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok) {
            errorMsg.innerText = data.error || 'Kuch gadbad ho gayi!';
            return;
        }

        if (isLogin) {
            currentUser = data.username;
            localStorage.setItem('skyway_user', currentUser);
            showChatApp();
        } else {
            alert('Signup successful! Ab aap login kar sakte hain.');
            switchTab('login');
        }
    } catch (err) {
        errorMsg.innerText = 'Server se connect nahi ho paya!';
    }
}

function showChatApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
    document.getElementById('my-username').innerText = currentUser;

    socket.emit('join', currentUser);
    loadSavedContacts();
}

function logout() {
    localStorage.removeItem('skyway_user');
    location.reload();
}

function openChat() {
    const target = document.getElementById('target-username').value.trim().toLowerCase();
    if (!target || target === currentUser) {
        alert('Kripya valid Unique ID daalein.');
        return;
    }
    currentChatUser = target;
    document.getElementById('chat-with-title').innerText = `Chatting with: ${target}`;
    
    saveContactToLocal(target);
    updateContactUI();
    fetchMessages();
}

function saveContactToLocal(username) {
    let contacts = JSON.parse(localStorage.getItem(`contacts_${currentUser}`)) || [];
    if (!contacts.includes(username)) {
        contacts.push(username);
        localStorage.setItem(`contacts_${currentUser}`, JSON.stringify(contacts));
    }
}

function loadSavedContacts() {
    updateContactUI();
}

function updateContactUI() {
    const contactsDiv = document.getElementById('contacts');
    contactsDiv.innerHTML = '';
    let contacts = JSON.parse(localStorage.getItem(`contacts_${currentUser}`)) || [];

    contacts.forEach(contact => {
        const btn = document.createElement('div');
        btn.className = `contact-item ${currentChatUser === contact ? 'active' : ''}`;
        
        const isOnline = activeUsersList.includes(contact);
        btn.innerHTML = `<span>${contact}</span> <span class="dot ${isOnline ? 'online' : 'offline'}"></span>`;
        
        btn.onclick = () => {
            currentChatUser = contact;
            document.getElementById('chat-with-title').innerText = `Chatting with: ${contact}`;
            updateContactUI();
            fetchMessages();
        };
        contactsDiv.appendChild(btn);
    });
}

async function fetchMessages() {
    if (!currentChatUser) return;
    try {
        const res = await fetch(`${SOCKET_URL}/api/messages/${currentUser}/${currentChatUser}`);
        const messages = await res.json();
        
        const list = document.getElementById('messages-list');
        list.innerHTML = '';
        messages.forEach(msg => {
            appendMessageUI(msg.sender === currentUser ? 'You' : msg.sender, msg.text);
        });
    } catch (err) {
        console.log("Error fetching messages:", err);
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentChatUser) return;

    const messageData = { sender: currentUser, receiver: currentChatUser, text };
    socket.emit('sendPrivateMessage', messageData);
    
    appendMessageUI('You', text);
    input.value = '';
}

function checkEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

function appendMessageUI(sender, text) {
    const list = document.getElementById('messages-list');
    const div = document.createElement('div');
    div.className = `message ${sender === 'You' ? 'sent' : 'received'}`;
    div.innerText = `${sender}: ${text}`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

let typingTimeout;
function emitTyping() {
    if (!currentChatUser) return;
    socket.emit('typing', { sender: currentUser, receiver: currentChatUser });
}

socket.on('displayTyping', (data) => {
    if (data.sender === currentChatUser) {
        const indicator = document.getElementById('typing-indicator');
        indicator.style.display = 'block';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            indicator.style.display = 'none';
        }, 1500);
    }
});

socket.on('receivePrivateMessage', (data) => {
    if (data.sender === currentChatUser || data.receiver === currentChatUser) {
        if (data.sender !== currentUser) {
            appendMessageUI(data.sender, data.text);
        }
    }
});

socket.on('updateUserStatus', (users) => {
    activeUsersList = users;
    if (currentChatUser) {
        const isOnline = activeUsersList.includes(currentChatUser);
        const statusSpan = document.getElementById('chat-target-status');
        statusSpan.innerText = isOnline ? 'Online' : 'Offline';
        statusSpan.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
    updateContactUI();
});
