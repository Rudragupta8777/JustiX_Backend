require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const caseRoutes = require('./routes/caseRoutes');
const socketHandler = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// Enable CORS for VR and Mobile
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // Allow large audio packets
});

connectDB();

app.use(express.json());

// Routes
app.use('/api/cases', caseRoutes);

// Socket Connection
io.on('connection', (socket) => {
    console.log('VR Headset Connected:', socket.id);
    socketHandler(io, socket);
});

const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));