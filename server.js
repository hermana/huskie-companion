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

// GET endpoint for getUpvotes
app.get('/getUpvotes', (req, res) => {
  const { comment_id } = req.query;
  
  if (!comment_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'comment_id query parameter is required' 
    });
  }

  const stmt = db.prepare(`
    SELECT id, user_id, item_type, item_id, created_at
    FROM upvotes
    WHERE item_type = 'comment' AND item_id = ?
    ORDER BY created_at ASC
  `);

  const upvotes = stmt.all(parseInt(comment_id));
  
  console.log(`getUpvotes was called for comment_id: ${comment_id}`);
  console.log(`Found ${upvotes.length} upvotes`);
  
  res.status(200).json({
    success: true,
    comment_id: parseInt(comment_id),
    upvotes: upvotes
  });
});

// POST endpoint for postUpvote
app.post('/postUpvote', (req, res) => {
  const { user_id, comment_id } = req.body || {};

  if (!user_id || !comment_id) {
    return res.status(400).json({
      success: false,
      error: 'user_id and comment_id are required'
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO upvotes (user_id, item_type, item_id)
      VALUES (?, 'comment', ?)
    `);

    const info = stmt.run(parseInt(user_id), parseInt(comment_id));

    console.log(`postUpvote was called for comment_id: ${comment_id}, user_id: ${user_id}`);
    console.log('Request body:', req.body);

    res.status(200).json({
      success: true,
      id: info.lastInsertRowid,
      message: 'Upvote added successfully'
    });
  } catch (error) {
    // Handle unique constraint violation (user already upvoted this comment)
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.log(`Upvote already exists for comment_id: ${comment_id}, user_id: ${user_id}`);
      return res.status(409).json({
        success: false,
        error: 'User has already upvoted this comment'
      });
    }
    
    // Handle other errors
    console.error('Error adding upvote:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add upvote'
    });
  }
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

