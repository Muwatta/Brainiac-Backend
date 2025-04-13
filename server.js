const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use(limiter);

app.use(cors({
  origin: ['http://localhost:5173', 'https://brainiacquiz.netlify.app'], // Add your frontend URLs
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json()); // Middleware to parse JSON request bodies

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Allow requests from your React app
    methods: ['GET', 'POST'],
  },
});

// In-memory leaderboard data
let leaderboard = [
  {
    "id": 1,
    "name": "John Doe",
    "school": "Example School",
    "score": 15,
    "timeUsed": 120,
    "avatar": "https://example.com/avatar.jpg",
    "likes": 5,
    "liked": false
  }
];

// API to get leaderboard data
app.get('/leaderboard', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 100;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedPlayers = leaderboard.slice(startIndex, endIndex);
  res.json(paginatedPlayers);
});

// API to submit a new score
app.post('/leaderboard', (req, res) => {
  const { name, school, class: playerClass, score, timeUsed } = req.body;

  if (!name || !school || !playerClass || score === undefined || timeUsed === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Add the new score to the leaderboard
  leaderboard.push({ name, school, class: playerClass, score, timeUsed });

  // Emit the new score to all connected clients
  io.emit('new_score', { name, school, class: playerClass, score, timeUsed });

  res.status(201).json({ message: 'Score submitted successfully!' });
});

// API to handle likes
app.post('/leaderboard/like', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const player = leaderboard.find((player) => player.id === id);
  if (player) {
    player.likes += 1;
    player.liked = true;
    return res.status(200).json({ message: 'Like added successfully!', player });
  }

  res.status(404).json({ error: 'Player not found' });
});

// API to handle unlikes
app.post('/leaderboard/unlike', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const player = leaderboard.find((player) => player.id === id);
  if (player) {
    player.likes = Math.max(0, player.likes - 1);
    player.liked = false;
    return res.status(200).json({ message: 'Like removed successfully!', player });
  }

  res.status(404).json({ error: 'Player not found' });
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle joining a room
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', { message: data.message });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Define a route for the root URL
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Start the server
const PORT = process.env.PORT || 4000; // Use the PORT environment variable or default to 4000

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});