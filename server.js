const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: 'http://localhost:5173', 
  methods: ['GET', 'POST'], 
  credentials: true, 
}));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Allow requests from your React app
    methods: ['GET', 'POST'],
  },
});

// In-memory leaderboard data
let leaderboard = [];

// API to get leaderboard data
app.get('/leaderboard', (req, res) => {
  res.json(leaderboard); // Send the leaderboard data as JSON
});

// API to submit a new score
app.post('/leaderboard', express.json(), (req, res) => {
  const { name, school, class: playerClass, score, timeUsed } = req.body;

  // Add the new score to the leaderboard
  leaderboard.push({ name, school, class: playerClass, score, timeUsed });

  // Sort and limit leaderboard to top 10
  leaderboard = leaderboard
    .reduce((acc, current) => {
      const uniqueKey = `${current.name}-${current.school}-${current.class}`;
      const existingPlayer = acc.find(
        (player) =>
          `${player.name}-${player.school}-${player.class}` === uniqueKey
      );
      if (!existingPlayer) {
        acc.push(current);
      }
      return acc;
    }, [])
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timeUsed - b.timeUsed;
    })
    .slice(0, 10);

  res.status(201).json({ message: 'Score submitted successfully!' });
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
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});