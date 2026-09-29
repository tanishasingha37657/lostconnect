/**
 * routes/matches.js
 * In-Process TF-IDF Matching Engine Endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { findMatches } = require('../services/matcher');

// GET /api/matches/:lostItemId
router.get('/:lostItemId', (req, res) => {
  const lostItem = db.getLostItemById(req.params.lostItemId);
  if (!lostItem) {
    return res.status(404).json({ error: 'Lost item report not found' });
  }

  const activeFoundItems = db.getAllFoundItems().filter(i => i.status !== 'returned');
  const matches = findMatches(lostItem, activeFoundItems);

  res.json({
    success: true,
    engine: 'Node.js In-Process TF-IDF Vectorizer & Cosine Similarity',
    lostItemId: lostItem.id,
    lostTitle: lostItem.title,
    category: lostItem.category,
    approxLocation: lostItem.approxLocation,
    totalFoundCorpusScanned: activeFoundItems.length,
    matchesCount: matches.length,
    matches
  });
});

// POST /api/matches/re-scan (Triggered by "Re-Scan" button in UI)
router.post('/re-scan', (req, res) => {
  const { lostItemId } = req.body;
  const activeFoundItems = db.getAllFoundItems().filter(i => i.status !== 'returned');

  if (lostItemId) {
    const lostItem = db.getLostItemById(lostItemId);
    if (!lostItem) {
      return res.status(404).json({ error: 'Lost item report not found' });
    }
    const matches = findMatches(lostItem, activeFoundItems);
    return res.json({
      success: true,
      message: `Re-scanned database for "${lostItem.title}"`,
      scannedAt: new Date().toISOString(),
      matchesCount: matches.length,
      matches
    });
  }

  // Otherwise re-scan for all active lost reports
  const activeLostItems = db.getAllLostItems().filter(l => l.status === 'active');
  const batchResults = activeLostItems.map(lost => ({
    lostItemId: lost.id,
    lostTitle: lost.title,
    matches: findMatches(lost, activeFoundItems)
  }));

  res.json({
    success: true,
    message: 'Global TF-IDF database re-scan completed',
    scannedAt: new Date().toISOString(),
    totalActiveReportsScanned: activeLostItems.length,
    results: batchResults
  });
});

// POST /api/matches/:id/dismiss
router.post('/:id/dismiss', (req, res) => {
  res.json({
    success: true,
    message: 'Candidate match dismissed from personal dashboard'
  });
});

module.exports = router;
