/**
 * routes/notifications.js
 * Email & Match Notification Endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { sendTestEmail, sendMatchNotificationEmail } = require('../services/email');

// POST /api/notifications/test-email
router.post('/test-email', async (req, res) => {
  const { email } = req.body;
  const result = await sendTestEmail(email);

  res.json({
    success: result.success,
    message: result.success ? 'Test match notification email dispatched!' : 'Failed to dispatch email',
    mode: result.mode,
    recipient: result.recipient,
    previewUrl: result.previewUrl,
    error: result.error
  });
});

// POST /api/notifications/dispatch-match
router.post('/dispatch-match', async (req, res) => {
  const { lostItemId, foundItemId, recipientEmail } = req.body;

  if (!lostItemId || !foundItemId) {
    return res.status(400).json({ error: 'lostItemId and foundItemId are required' });
  }

  const lostItem = db.getLostItemById(lostItemId);
  const foundItem = db.getFoundItemById(foundItemId);

  if (!lostItem || !foundItem) {
    return res.status(404).json({ error: 'Lost item or Found item not found' });
  }

  const result = await sendMatchNotificationEmail({
    recipientEmail: recipientEmail || lostItem.contactEmail,
    studentName: 'Test Student',
    lostItem,
    matchedFoundItem: foundItem,
    matchScore: 0.94,
    matchPercentage: '94%'
  });

  res.json({
    success: result.success,
    message: 'Match notification email dispatched',
    result
  });
});

module.exports = router;
