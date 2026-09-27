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

// MongoDB Connection (Apna MongoDB URI yahan daalein ya environment variable use karein)
const MONGO_URI = process.env.MONGO_URI || "YAHAN_APNA_MONGODB_URI_DAALEIN"; 

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected Successfully")).catch(err => console.log("DB Connection Error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = username.trim().toLowerCase();
        const existing = await User.findOne({ username: cleanUser });
        if (existing) return res.status(400).json({ error: 'Username pehle se maujood hai!' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username: cleanUser, password: hashedPassword });
        await newUser.save();
        res.json({ message: 'Signup safal raha! Ab login karein.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = username.trim().toLowerCase();
        const user = await User.findOne({ username: cleanUser });
        if (!user) return res.status(400).json({ error: 'Galat username ya password!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Galat username ya password!' });

        const token = jwt.sign({ username: cleanUser }, 'secret_key', { expiresIn: '1h' });
        res.json({ token, username: cleanUser });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Messages History Route
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
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.io Logic for Online Status, Typing, & Real-Time Messages
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Jab user login karke join ho
    socket.on('join', (username) => {
        if (username) {
            socket.username = username.trim().toLowerCase();
            onlineUsers[socket.username] = socket.id;
            io.emit('updateUserStatus', Object.keys(onlineUsers));
        }
    });

    // Jab koi user message type kare
    socket.on('typing', (data) => {
        const receiverSocketId = onlineUsers[data.receiver.trim().toLowerCase()];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('displayTyping', { sender: data.sender });
        }
    });

    // Private Message logic & Database Save
    socket.on('sendPrivateMessage', async (data) => {
        try {
            const newMessage = new Message({
                sender: data.sender.trim().toLowerCase(),
                receiver: data.receiver.trim().toLowerCase(),
                text: data.text
            });
            await newMessage.save();

            const receiverSocketId = onlineUsers[data.receiver.trim().toLowerCase()];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receivePrivateMessage', data);
            }
            socket.emit('receivePrivateMessage', data);
        } catch (err) {
            console.log('Message save error:', err);
        }
    });

    // Jab user disconnect ho jaye (app band kare ya logout kare)
    socket.on('disconnect', () => {
        if (socket.username) {
            delete onlineUsers[socket.username];
            io.emit('updateUserStatus', Object.keys(onlineUsers));
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
