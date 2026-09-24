const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// 🔴 UPDATED CORS SETTING (Live message ke liye zaroori)
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// 🔴 AAPKA ASLI MONGODB LINK YAHAN HAI
const MONGO_URI = 'mongodb+srv://mohitkaremore87_db_user:9dpflcReXLn5jkjn@chatapp.xirfhto.mongodb.net/skyway?retryWrites=true&w=majority';
const JWT_SECRET = 'skyway_secret_key_123'; 

// MongoDB se connect karna
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ DB Error:', err.message));

// --- DATABASE MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- AUTHENTICATION APIs ---

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Yeh User ID pehle se liya gaya hai!' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.json({ message: 'Account ban gaya! Ab login karein.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'User ID nahi mili!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Password galat hai!' });

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/messages/:user1/:user2', async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// --- SOCKET.IO REAL-TIME CHAT ---
io.on('connection', (socket) => {
    socket.on('join', (username) => {
        socket.username = username;
        socket.join(username); 
        console.log(`🔵 ${username} is online`);
    });

    socket.on('sendPrivateMessage', async (data) => {
        const { sender, receiver, text } = data;
        const newMessage = new Message({ sender, receiver, text });
        await newMessage.save();

        io.to(receiver).emit('receivePrivateMessage', { sender, receiver, text, timestamp: new Date() });
        io.to(sender).emit('receivePrivateMessage', { sender, receiver, text, timestamp: new Date() });
    });

    socket.on('disconnect', () => {
        console.log('🔴 User disconnected');
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));