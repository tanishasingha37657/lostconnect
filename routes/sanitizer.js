/**
 * routes/sanitizer.js
 * PII Sanitizer Interactive Preview Route
 */

const express = require('express');
const router = express.Router();
const { sanitizeText } = require('../services/sanitizer');

// POST /api/items/sanitize-preview
router.post('/sanitize-preview', (req, res) => {
  const { rawDescription } = req.body;

  if (!rawDescription) {
    return res.status(400).json({ error: 'rawDescription field is required' });
  }

  const result = sanitizeText(rawDescription);

  res.json({
    success: true,
    original: result.original,
    sanitizedDescription: result.sanitized,
    redactedCount: result.redactedCount,
    redactions: result.redactions
  });
});

module.exports = router;
