const express = require('express');
const http = require('http');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create or open SQLite database
const db = new sqlite3.Database('chat.db');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, msg TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// Serve the frontend files in public folder
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to get past 50 messages from database
app.get('/history', (req, res) => {
  db.all('SELECT user, msg, ts FROM messages ORDER BY id DESC LIMIT 50', (err, rows) => {
    if (err) {
      res.status(500).send([]);
    } else {
      res.send(rows.reverse());
    }
  });
});

// Handle socket connection for real-time chat
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('chat message', ({ user, msg }) => {
    io.emit('chat message', { user, msg, ts: new Date() });
    db.run('INSERT INTO messages (user, msg) VALUES (?, ?)', [user, msg]);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
