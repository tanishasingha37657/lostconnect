/**
 * server.js
 * LostConnect - Campus Lost & Found Portal
 * Full Stack REST API & Static Application Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize app
const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded media
app.use('/uploads', express.static(uploadsDir));

// Import API Routers
const authRoutes = require('./routes/auth');
const foundItemsRoutes = require('./routes/foundItems');
const lostItemsRoutes = require('./routes/lostItems');
const claimsRoutes = require('./routes/claims');
const matchesRoutes = require('./routes/matches');
const securityRoutes = require('./routes/security');
const sanitizerRoutes = require('./routes/sanitizer');
const uploadRoutes = require('./routes/upload');
const notificationsRoutes = require('./routes/notifications');

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/found-items', foundItemsRoutes);
app.use('/api/lost-items', lostItemsRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/items', sanitizerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    portal: 'LostConnect - Christ University',
    timestamp: new Date().toISOString(),
    engine: 'Node.js In-Process TF-IDF Similarity + Weak-Signal Offline Passes'
  });
});

// Serve the React build when available, while retaining static legacy assets.
const buildDir = path.join(__dirname, 'dist');
app.use(express.static(buildDir));
app.use(express.static(__dirname));

// Fallback to index.html for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  }
  res.sendFile(path.join(fs.existsSync(path.join(buildDir, 'index.html')) ? buildDir : __dirname, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  LostConnect Full-Stack Server is running!`);
  console.log(`  Portal URL:       http://localhost:${PORT}/`);
  console.log(`  API Health:       http://localhost:${PORT}/api/health`);
  console.log(`  TF-IDF Matcher:   Active (In-process Node.js)`);
  console.log(`  Offline Pass:     Ready (Weak-Campus-Signal Compliant)`);
  console.log(`  Security Desk:    Central Block Room 104`);
  console.log(`====================================================`);
});
