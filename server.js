const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection using Environment Variable
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.log('DB Connection Error: ', err.message));

// User Schema & Model (For Signup/Login)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(400).json({ error: 'Invalid ID or password' });
    }
    res.status(200).json({ message: 'Login successful', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Track online users for 1-on-1 private chat: { username: socket.id }
const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Register user socket mapping
  socket.on('register_user', (username) => {
    onlineUsers[username] = socket.id;
    console.log(`User registered: ${username} -> ${socket.id}`);
  });

  // Handle 1-on-1 Private Messaging
  socket.on('send_message', (data) => {
    const recipientSocketId = onlineUsers[data.recipient];

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', data);
    }
    
    socket.emit('receive_message', data);
  });

  // Handle Message Read Status (Blue Ticks)
  socket.on('message_read', (data) => {
    const senderSocketId = onlineUsers[data.sender];
    if (senderSocketId) {
      io.to(senderSocketId).emit('message_read_receipt', { messageId: data.messageId });
    }
  });

  socket.on('disconnect', () => {
    for (let username in onlineUsers) {
      if (onlineUsers[username] === socket.id) {
        delete onlineUsers[username];
        break;
      }
    }
    console.log('A user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
