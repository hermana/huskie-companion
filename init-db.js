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

const demoData = [   
  `INSERT INTO users (username) VALUES ('Rover');`,
  `INSERT INTO users (username, num_clicks) VALUES ('Peedy', 5);`,
  `INSERT INTO users (username, num_clicks) VALUES ('Bonzi', 15);`,
  `INSERT INTO questions (user_id, title, body) VALUES (2, 'Governance', 'Doing my course paper on Indigenous Governance and how it differs from our Provincial and Federal government. What are some good resources to start with?');`,
  `INSERT INTO questions (user_id, title, body) VALUES (3, 'Languages', 'I''m trying to find resources on what has been done in recent times (past five years) to preserve and help teach Indigenous languages. Has anybody heard about any initiatives on this?');`,
  `INSERT INTO questions (user_id, title, body) VALUES (2, 'Ed Major - Question', 'Hey, I''m and Education Major and going to be doing my internship next semester. I''m coming up with ideas on good ways to teach what we learned in the course. Has anyone come across any resources that would be good easy to understand or appropriate for a grade 5 class?');`,
  `INSERT INTO questions (user_id, title, body) VALUES (1, 'Question about assignment', 'Hey, I''m trying to do the assignment on the Indian Act. When I search for Indian Act I see so much conflicting info- how are you guys filtering your search??');`,
  `INSERT INTO comments (user_id, question_id, body) VALUES (3, 1, 'Try searching for Cheif Poundmaker. He brought up a lot of good info for me!');`,
  `INSERT INTO comments (user_id, question_id, body) VALUES (1, 2, 'When I was at UAlberta, there was a gamified Cree language learning app under development. I can reach out to my old contacts there and find out if it''s still going!');`,
  `INSERT INTO comments (user_id, question_id, body) VALUES (3, 3, 'Actually, you might want to email the program coordinator. They organize some outreach to local schools and could probably help you.');`,
  `INSERT INTO comments (user_id, question_id, body) VALUES (1, 1, 'You should search up Louis Riel');`
]

// Always enable foreign keys
db.exec("PRAGMA foreign_keys = ON;");

if (!dbExists) {
  console.log("Running initial schema setup...");

  db.exec(`
    -- Users table
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        xp INTEGER DEFAULT 100,
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
  for (const statement of demoData) {
    console.log("Adding demo data:", statement);
    stmt = db.prepare(statement);
    stmt.run();
   // db.exec(statement);
  }

} else {
  console.log("Database already exists. Skipping schema creation.");
}

module.exports = db;
