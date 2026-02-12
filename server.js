require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // <--- IMPORT THIS
const connectDB = require('./config/db');
const caseRoutes = require('./routes/caseRoutes');
const socketHandler = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// 1. ALLOW CORS FOR REST API (Fixes "Failed to fetch")
app.use(cors()); 

// 2. Enable CORS for Socket.io
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 
});

connectDB();
app.use(express.json());

// Routes
app.use('/api/cases', caseRoutes);

// Socket Connection
io.on('connection', (socket) => {
    console.log('Device Connected:', socket.id);
    socketHandler(io, socket);
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));