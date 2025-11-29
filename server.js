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
  
  console.log('postQuestion was called');
  console.log('Request body:', req.body);
  
  res.status(200).json({ 
    success: true, 
    id: info.lastInsertRowid,
    message: 'Question received' 
  });
});

// GET endpoint for getQuestions
app.get('/getQuestions', (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'user_id query parameter is required' 
    });
  }

  const stmt = db.prepare(`
    SELECT id, user_id, accepted_response, title, body, created_at
    FROM questions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);

  const questions = stmt.all(parseInt(user_id));
  
  console.log(`getQuestions was called for user_id: ${user_id}`);
  console.log(`Found ${questions.length} questions`);
  
  res.status(200).json({
    success: true,
    user_id: parseInt(user_id),
    questions: questions
  });
});

// GET endpoint for getComments
app.get('/getComments', (req, res) => {
  const { question_id } = req.query;
  
  if (!question_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'question_id query parameter is required' 
    });
  }

  const stmt = db.prepare(`
    SELECT id, user_id, question_id, body, created_at
    FROM comments
    WHERE question_id = ?
    ORDER BY created_at ASC
  `);

  const comments = stmt.all(parseInt(question_id));
  
  console.log(`getComments was called for question_id: ${question_id}`);
  console.log(`Found ${comments.length} comments`);
  
  res.status(200).json({
    success: true,
    question_id: parseInt(question_id),
    comments: comments
  });
});

// POST endpoint for postComment
app.post('/postComment', (req, res) => {
  const { user_id, question_id, body } = req.body || {};

  if (!user_id || !question_id || !body) {
    return res.status(400).json({
      success: false,
      error: 'user_id, question_id, and body are required'
    });
  }

  const stmt = db.prepare(`
    INSERT INTO comments (user_id, question_id, body)
    VALUES (?, ?, ?)
  `);

  const info = stmt.run(parseInt(user_id), parseInt(question_id), body);

  console.log(`postComment was called for question_id: ${question_id}`);
  console.log('Request body:', req.body);

  res.status(200).json({
    success: true,
    id: info.lastInsertRowid,
    message: 'Comment received'
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

