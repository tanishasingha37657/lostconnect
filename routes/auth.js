/**
 * routes/auth.js
 * Campus Authentication & Session Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Campus email is required' });
  }

  // Pre-seeded or existing user lookup
  let user = await db.getUserByEmail(email);

  if (!user) {
    // If not in database, create a campus student profile
    const studentMatch = email.match(/^([a-z.]+)(?:\d*)@/i);
    const inferredName = studentMatch ? studentMatch[1].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Campus Student';
    user = await db.createUser({
      name: inferredName,
      email,
      studentId: '2' + Math.floor(100000 + Math.random() * 900000),
      role: email.includes('security') ? 'security' : 'student',
      department: 'Christ University'
    });
  }

  // Generate simulated session token
  const token = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role })).toString('base64');

  res.json({
    success: true,
    message: `Signed in as ${user.name}`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      role: user.role,
      department: user.department
    },
    token
  });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, studentId, department } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and university email are required' });
  }

  const existing = await db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Account already registered with this email' });
  }

  const user = await db.createUser({
    name,
    email,
    studentId: studentId || '2600000',
    department: department || 'School of Sciences',
    role: 'student'
  });

  const token = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role })).toString('base64');

  res.status(201).json({
    success: true,
    message: 'Campus account registered successfully',
    user,
    token
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default to guest state
    return res.json({ authenticated: false, user: null });
  }

  let payload;
  try {
    const rawToken = authHeader.split(' ')[1];
    payload = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf8'));
  } catch (err) {
    res.json({ authenticated: false, user: null });
    return;
  }

  if (!payload || typeof payload.email !== 'string') {
    return res.json({ authenticated: false, user: null });
  }

  const user = await db.getUserByEmail(payload.email);
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }
  res.json({ authenticated: true, user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out of LostConnect' });
});

module.exports = router;
