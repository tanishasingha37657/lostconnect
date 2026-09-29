/**
 * routes/foundItems.js
 * Found Items Public Catalog & Intake Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { sanitizeText } = require('../services/sanitizer');
const { findMatches } = require('../services/matcher');
const { sendMatchNotificationEmail } = require('../services/email');

// GET /api/found-items (Search & Filter)
router.get('/', (req, res) => {
  const { search, category, location, status } = req.query;
  let items = db.getAllFoundItems();

  if (category && category !== 'all') {
    items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
  }

  if (location && location !== 'all') {
    items = items.filter(i => i.location.toLowerCase().includes(location.toLowerCase()));
  }

  if (status && status !== 'all') {
    items = items.filter(i => i.status === status);
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q))
    );
  }

  // Hide internal answers for security, expose challenge flag
  const safeItems = items.map(item => {
    const challenge = db.getChallengeByItemId(item.id);
    return {
      ...item,
      hasChallenge: !!challenge
    };
  });

  res.json({
    success: true,
    total: safeItems.length,
    items: safeItems
  });
});

// GET /api/found-items/:id
router.get('/:id', (req, res) => {
  const item = db.getFoundItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Found item not found' });
  }

  const challenge = db.getChallengeByItemId(item.id);

  res.json({
    success: true,
    item: {
      ...item,
      hasChallenge: !!challenge,
      // Only expose the challenge question prompt, NEVER the answer
      challengePrompt: challenge ? challenge.prompt : null
    }
  });
});

// POST /api/found-items (Report Found Item)
router.post('/', (req, res) => {
  const {
    title,
    category,
    location,
    custodyLocation,
    description,
    finderName,
    finderPhone,
    finderEmail,
    photoUrl,
    challengeQuestion,
    challengeAnswer
  } = req.body;

  if (!title || !category || !location || !description) {
    return res.status(400).json({ error: 'Title, category, location, and description are required' });
  }

  // Automated PII Redaction on description before storing
  const piiResult = sanitizeText(description);

  const newItem = db.createFoundItem({
    title,
    category,
    location,
    custodyLocation: custodyLocation || 'Central Security Desk (Room 104)',
    date: 'Just now',
    description: piiResult.sanitized,
    rawDescriptionOriginal: piiResult.original,
    redactedPiiCount: piiResult.redactedCount,
    finderContact: {
      name: finderName || 'Anonymous Campus Finder',
      phone: finderPhone || '',
      email: finderEmail || ''
    },
    photoUrl: photoUrl || '',
    status: 'in_custody'
  });

  // If founder provided a Blind Ownership Challenge, register it
  let registeredChallenge = null;
  if (challengeQuestion && challengeAnswer) {
    registeredChallenge = db.createChallenge({
      foundItemId: newItem.id,
      prompt: challengeQuestion,
      answer: challengeAnswer
    });
  }

  // Cross-check in-process TF-IDF against active lost items
  const activeLostItems = db.getAllLostItems().filter(l => l.status === 'active');
  const prospectiveMatches = [];
  for (const lost of activeLostItems) {
    const matches = findMatches(lost, [newItem]);
    if (matches.length > 0 && matches[0].score >= 0.5) {
      prospectiveMatches.push({
        lostItemId: lost.id,
        lostTitle: lost.title,
        studentId: lost.studentId,
        score: matches[0].score,
        matchPercentage: matches[0].matchPercentage
      });

      // Dispatch automated match email to student who lost this item
      sendMatchNotificationEmail({
        recipientEmail: lost.contactEmail,
        studentName: 'Student',
        lostItem: lost,
        matchedFoundItem: newItem,
        matchScore: matches[0].score,
        matchPercentage: matches[0].matchPercentage
      }).catch(e => console.error('[Background Email Failed]:', e.message));
    }
  }

  res.status(201).json({
    success: true,
    message: 'Found item cataloged and deposited record generated',
    item: newItem,
    piiSanitized: piiResult.redactedCount > 0,
    hasChallenge: !!registeredChallenge,
    prospectiveLostMatchesFound: prospectiveMatches.length,
    prospectiveMatches
  });
});

// PATCH /api/found-items/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = db.updateFoundItemStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Found item not found' });
  }

  res.json({
    success: true,
    message: `Item status updated to ${status}`,
    item: updated
  });
});

module.exports = router;
