const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = "mongodb+srv://mohitkaremore27_db_user:Mohit321@cluster0.oisxee7.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
.then(() => {
    console.log("MongoDB Connected Successfully!");
}).catch(err => {
    console.error("DB Connection Error:", err);
});

// User Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Message Schema & Model
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true, lowercase: true, trim: true },
    receiver: { type: String, required: true, lowercase: true, trim: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const JWT_SECRET = "skyway_secret_key_999";

// Signup API
app.post('/api/signup', async (req, res) => {
    try {
        let { username, password } = req.body;
        username = username.trim().toLowerCase();
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Yeh Unique ID pehle se li ja chuki hai!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ message: 'Signup safal ho gaya! Ab aap login karein.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error aa gaya!' });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        username = username.trim().toLowerCase();

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'User nahi mila! Pehle Signup karein.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Password galat hai!' });
        }

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Login karte samay error aaya!' });
    }
});

// Get Messages API
app.get('/api/messages/:user1/:user2', async (req, res) => {
    try {
        let u1 = req.params.user1.trim().toLowerCase();
        let u2 = req.params.user2.trim().toLowerCase();

        const messages = await Message.find({
            $or: [
                { sender: u1, receiver: u2 },
                { sender: u2, receiver: u1 }
            ]
        }).sort({ timestamp: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Messages load nahi ho paye.' });
    }
});

// Socket.io Logic for Online/Offline, Typing & Messaging
let activeUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (username) => {
        if (!username) return;
        const cleanUser = username.trim().toLowerCase();
        activeUsers[socket.id] = cleanUser;
        io.emit('updateUserStatus', Object.values(activeUsers));
    });

    socket.on('sendPrivateMessage', async (data) => {
        try {
            const sender = data.sender.trim().toLowerCase();
            const receiver = data.receiver.trim().toLowerCase();
            const text = data.text;

            const newMessage = new Message({ sender, receiver, text });
            await newMessage.save();

            io.emit('receivePrivateMessage', { sender, receiver, text });
        } catch (err) {
            console.log("Message save error:", err);
        }
    });

    socket.on('typing', (data) => {
        if (data && data.receiver) {
            io.emit('displayTyping', { sender: data.sender, receiver: data.receiver });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete activeUsers[socket.id];
        io.emit('updateUserStatus', Object.values(activeUsers));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
