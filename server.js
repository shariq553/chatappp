const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database('chat.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS babies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    baby TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS population (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    msg TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS private_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    recipient TEXT,
    msg TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: false,
}));

function protectedRoute(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/');
}

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).send('Server error');
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (error) => {
      if (error) return res.status(400).send('Username already taken');
      res.status(200).send('Registered successfully');
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing username or password');
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Server error');
    if (!row) return res.status(400).send('Invalid credentials');
    bcrypt.compare(password, row.password, (err, result) => {
      if (result) {
        req.session.user = username;
        res.status(200).send('Login successful');
      } else {
        res.status(400).send('Invalid credentials');
      }
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.post('/add-baby', (req, res) => {
  if (!req.session.user) return res.status(401).send('Please log in');
  const { baby } = req.body;
  if (!baby) return res.status(400).send('Missing baby username');
  db.run('INSERT INTO babies (user, baby) VALUES (?, ?)', [req.session.user, baby], (error) => {
    if (error) return res.status(400).send('Already added or error');
    res.status(200).send('Baby added!');
  });
});

app.get('/babies', (req, res) => {
  if (!req.session.user) return res.status(401).json([]);
  db.all('SELECT baby FROM babies WHERE user=?', [req.session.user], (err, rows) => {
    const babies = rows ? rows.map(r => r.baby) : [];
    res.json(babies);
  });
});

app.get('/population-history', (req, res) => {
  db.all('SELECT * FROM population ORDER BY id ASC LIMIT 50', (err, rows) => {
    res.json(rows || []);
  });
});

app.get('/private-history/:baby', (req, res) => {
  if (!req.session.user) return res.status(401).json([]);
  const from = req.session.user;
  const to = req.params.baby;
  db.all(
    `SELECT sender, recipient, msg, ts FROM private_messages
     WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
     ORDER BY ts ASC LIMIT 50`,
    [from, to, to, from],
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.get('/chat', protectedRoute, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

io.use((socket, next) => {
  let session = socket.request.session;
  if (session && session.user) next();
  else next(new Error("Unauthorized"));
});

io.on('connection', (socket) => {
  const req = socket.request;
  const user = req.session && req.session.user ? req.session.user : 'Unknown';

  // Group chat messages
  socket.on('population message', (msg) => {
    io.emit('population message', { user, msg, ts: new Date() });
    db.run('INSERT INTO population (user, msg) VALUES (?, ?)', [user, msg]);
  });

  socket.on('typing', () => {
    socket.broadcast.emit('typing', user);
  });
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', user);
  });

  // Private messages
  socket.on('private message', ({ to, msg }) => {
    db.run('INSERT INTO private_messages (sender, recipient, msg) VALUES (?, ?, ?)', [user, to, msg]);
    io.sockets.sockets.forEach((s) => {
      const sUser = s.request.session && s.request.session.user;
      if (sUser === to || sUser === user) {
        s.emit('private message', { from: user, to, msg, ts: new Date() });
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
