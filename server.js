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
    SELECT id, user_id, title, body, created_at
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
    SELECT id, user_id, question_id, body, accepted_response, created_at
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

// PUT endpoint for updateAcceptedResponse
app.put('/updateAcceptedResponse', (req, res) => {
  const { comment_id } = req.body || {};

  if (!comment_id) {
    return res.status(400).json({
      success: false,
      error: 'comment_id is required'
    });
  }

  try {
    // First, get the question_id for this comment
    const getQuestionStmt = db.prepare(`
      SELECT question_id
      FROM comments
      WHERE id = ?
    `);
    
    const comment = getQuestionStmt.get(parseInt(comment_id));
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    const question_id = comment.question_id;

    // Check if any other comment for this question is already accepted
    const checkAcceptedStmt = db.prepare(`
      SELECT id
      FROM comments
      WHERE question_id = ? AND accepted_response = 1 AND id != ?
    `);
    
    const existingAccepted = checkAcceptedStmt.get(question_id, parseInt(comment_id));
    
    // If another comment is already accepted, don't allow this update
    if (existingAccepted) {
      return res.status(409).json({
        success: false,
        error: 'Another comment is already marked as the accepted response for this question'
      });
    }

    // Set all comments for this question to 0 (not accepted)
    const clearStmt = db.prepare(`
      UPDATE comments
      SET accepted_response = 0
      WHERE question_id = ?
    `);
    clearStmt.run(question_id);

    // Then set the selected comment to 1 (accepted)
    const acceptStmt = db.prepare(`
      UPDATE comments
      SET accepted_response = 1
      WHERE id = ?
    `);

    const info = acceptStmt.run(parseInt(comment_id));

    console.log(`updateAcceptedResponse was called for comment_id: ${comment_id}, question_id: ${question_id}`);
    console.log(`Rows affected: ${info.changes}`);

    res.status(200).json({
      success: true,
      comment_id: parseInt(comment_id),
      question_id: question_id,
      message: 'Accepted response updated successfully'
    });
  } catch (error) {
    console.error('Error updating accepted response:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update accepted response'
    });
  }
});

// PUT endpoint for updateUserXP
app.put('/updateUserXP', (req, res) => {
  const { user_id, xp } = req.body || {};

  if (!user_id || xp === undefined) {
    return res.status(400).json({
      success: false,
      error: 'user_id and xp are required'
    });
  }

  // Validate that xp is a number
  const xpNumber = parseInt(xp);
  if (isNaN(xpNumber)) {
    return res.status(400).json({
      success: false,
      error: 'xp must be a valid number'
    });
  }

  try {
    const stmt = db.prepare(`
      UPDATE users
      SET xp = ?
      WHERE id = ?
    `);

    const info = stmt.run(xpNumber, parseInt(user_id));

    console.log(`updateUserXP was called for user_id: ${user_id}, xp: ${xpNumber}`);
    console.log(`Rows affected: ${info.changes}`);

    if (info.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user_id: parseInt(user_id),
      xp: xpNumber,
      message: 'User XP updated successfully'
    });
  } catch (error) {
    console.error('Error updating user XP:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user XP'
    });
  }
});

// PUT endpoint for updateUserNumClicks
app.put('/updateUserNumClicks', (req, res) => {
  const { user_id, num_clicks } = req.body || {};

  if (!user_id || num_clicks === undefined) {
    return res.status(400).json({
      success: false,
      error: 'user_id and num_clicks are required'
    });
  }

  // Validate that num_clicks is a number
  const numClicksNumber = parseInt(num_clicks);
  if (isNaN(numClicksNumber)) {
    return res.status(400).json({
      success: false,
      error: 'num_clicks must be a valid number'
    });
  }

  try {
    const stmt = db.prepare(`
      UPDATE users
      SET num_clicks = ?
      WHERE id = ?
    `);

    const info = stmt.run(numClicksNumber, parseInt(user_id));

    console.log(`updateUserNumClicks was called for user_id: ${user_id}, num_clicks: ${numClicksNumber}`);
    console.log(`Rows affected: ${info.changes}`);

    if (info.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user_id: parseInt(user_id),
      num_clicks: numClicksNumber,
      message: 'User num_clicks updated successfully'
    });
  } catch (error) {
    console.error('Error updating user num_clicks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user num_clicks'
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

