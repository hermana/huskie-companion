const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "forum.db");

// Boolean: does the database file already exist?
const dbExists = fs.existsSync(DB_PATH);

if (!dbExists) {
  console.log("Database does not exist. Creating new SQLite database...");
  fs.writeFileSync(DB_PATH, ""); // Create empty file
}

const db = new Database(DB_PATH);

// Always enable foreign keys
db.exec("PRAGMA foreign_keys = ON;");

if (!dbExists) {
  console.log("Running initial schema setup...");

  db.exec(`
    -- Users table
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        xp INTEGER DEFAULT 0,
        num_clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO users (username) VALUES ('testuser');

    -- Questions table
    CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Comments table
    CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        accepted_response INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    -- Upvotes table
    -- Stores a single upvote per user per item.
    -- "item_type" tells whether the upvote is for a question or a comment.
    CREATE TABLE upvotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_type TEXT CHECK(item_type IN ('question', 'comment')) NOT NULL,
        item_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_type, item_id)
    );

    CREATE INDEX idx_questions_user ON questions(user_id);
    CREATE INDEX idx_comments_question ON comments(question_id);
    CREATE INDEX idx_comments_user ON comments(user_id);
    CREATE INDEX idx_upvotes_item ON upvotes(item_type, item_id);
  `);

  console.log("Database initialized with schema.");
} else {
  console.log("Database already exists. Skipping schema creation.");
}

module.exports = db;
