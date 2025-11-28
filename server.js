const express = require('express');
//const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = require("./init-db.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// CORS middleware to allow cross-origin requests
//FIXME: do we need this and what does it do?? 
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// POST endpoint for postQuestion
app.post('/postQuestion', (req, res) => {
  const { user_id, title, body } = req.body;

  const stmt = db.prepare(`
    INSERT INTO questions (user_id, title, body)
    VALUES (?, ?, ?)
  `);

  const info = stmt.run(user_id, title, body);
  res.json({ id: info.lastInsertRowid });

  console.log('postQuestion was called');
  console.log('Request body:', req.body);
  
  res.status(200).json({ 
    success: true, 
    message: 'Question received' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

