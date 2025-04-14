const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

app.use(limiter);
app.use(express.json());

// CORS setup
const allowedOrigins = [
  'http://localhost:5173',
  'https://brainiacquiz.netlify.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// In-memory leaderboard (empty at the start)
let leaderboard = [];

// GET leaderboard (pagination for display)
app.get('/leaderboard', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10; // Change the limit based on your needs
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedPlayers = leaderboard.slice(startIndex, endIndex);
  res.json(paginatedPlayers);
});

// POST a new score (when a player completes a quiz)
app.post('/leaderboard', (req, res) => {
  const { playerId, name, school, playerClass, score, timeUsed } = req.body;

  if (!playerId || !name || !school || !playerClass || score === undefined || timeUsed === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if player exists, if so update their score, else create new player
  let player = leaderboard.find(p => p.id === playerId);

  if (player) {
    // Update existing player's score
    player.score = score;
    player.timeUsed = timeUsed;
  } else {
    // Create a new player entry
    player = {
      id: playerId,
      name,
      school,
      class: playerClass,
      score,
      timeUsed,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${name.split(' ')[0]}`,
      likes: 0,
      liked: false,
    };

    leaderboard.push(player);
  }

  // Emit the updated leaderboard to all connected clients
  io.emit('update_leaderboard', leaderboard);

  res.status(201).json({ message: 'Score submitted successfully!', player });
});

// POST to like/unlike a player
app.post('/leaderboard/like', (req, res) => {
  const { playerId, liked } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const player = leaderboard.find(p => p.id === playerId);

  if (player) {
    player.likes += liked ? 1 : -1; // Increment or decrement likes
    player.liked = liked;

    // Emit updated likes to all clients
    io.emit('update_likes', { id: player.id, likes: player.likes });

    return res.status(200).json({ message: `Like ${liked ? 'added' : 'removed'}`, player });
  }

  return res.status(404).json({ error: 'Player not found' });
});

// WebSocket events
io.on('connection', (socket) => {
  console.log('A user connected');

  // Emit the current leaderboard to newly connected clients
  socket.emit('update_leaderboard', leaderboard);

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
