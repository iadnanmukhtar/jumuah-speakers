// @ts-check
const mysql = require('mysql');
const config = require('./config');

// Single shared connection pool for the whole app.
const db = mysql.createPool(config.db);

function initSchema() {
  // Keep schema bootstrap here so new environments self-initialize.
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(30) UNIQUE NOT NULL,
      bio TEXT,
      password_hash VARCHAR(255),
      avatar_url VARCHAR(255),
      is_admin TINYINT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      time VARCHAR(10) NOT NULL,
      topic VARCHAR(255),
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      speaker_id INT,
      reminder_24_sent TINYINT NOT NULL DEFAULT 0,
      reminder_6_sent TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (speaker_id) REFERENCES users(id)
    );
  `;

  db.query(schemaSql, err => {
    if (err) {
      console.error('Error initializing schema', err);
    } else {
      console.log('Database schema ensured.');
    }
  });
}

function seedAdmin() {
  const { email, phone, password } = config.admin;

  // Ensure at least one admin exists for a fresh database.
  db.query(
    'SELECT * FROM users WHERE is_admin = ? LIMIT 1',
    [1],
    (err, results) => {
      if (err) {
        console.error('Error checking admin user', err);
        return;
      }
      if (!results || results.length === 0) {
        db.query(
          `INSERT INTO users (name, email, phone, bio, password_hash, is_admin)
           VALUES (?, ?, ?, ?, ?, 1)`,
          ['Site Admin', email, phone, 'Default admin account', password],
          err2 => {
            if (err2) {
              console.error('Error creating admin user', err2);
            } else {
              console.log('Default admin user created:', email);
            }
          }
        );
      }
    }
  );
}

initSchema();
seedAdmin();

module.exports = db;
