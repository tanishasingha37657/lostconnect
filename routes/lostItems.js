/**
 * routes/lostItems.js
 * Lost Item Reporting & Student Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { findMatches } = require('../services/matcher');
const { sendMatchNotificationEmail } = require('../services/email');

// POST /api/lost-items (Submit Lost Report)
router.post('/', async (req, res) => {
  const {
    title,
    category,
    approxLocation,
    lostDateTime,
    contactEmail,
    studentId,
    description,
    photoUrl
  } = req.body;

  if (!title || !category || !approxLocation || !description) {
    return res.status(400).json({ error: 'Title, category, location, and description are required' });
  }

  const newLost = db.createLostItem({
    title,
    category,
    approxLocation,
    lostDateTime: lostDateTime || new Date().toLocaleString(),
    contactEmail: contactEmail || 'student@christuniversity.in',
    studentId: studentId || '2600000',
    description,
    photoUrl: photoUrl || '',
    status: 'active'
  });

  // Run in-process TF-IDF vector similarity immediately against existing found items
  const activeFoundItems = db.getAllFoundItems().filter(i => i.status !== 'returned');
  const candidateMatches = findMatches(newLost, activeFoundItems);

  let emailDispatched = false;
  let emailPreviewUrl = null;

  // If a high-confidence match is detected (score >= 0.50), trigger email notification
  if (candidateMatches.length > 0 && candidateMatches[0].score >= 0.5) {
    const top = candidateMatches[0];
    const emailResult = await sendMatchNotificationEmail({
      recipientEmail: newLost.contactEmail,
      studentName: 'Test Student',
      lostItem: newLost,
      matchedFoundItem: {
        title: top.foundItemTitle,
        category: top.category,
        location: top.location,
        custodyLocation: top.custodyStatus,
        description: top.description
      },
      matchScore: top.score,
      matchPercentage: top.matchPercentage
    });

    emailDispatched = emailResult.success;
    emailPreviewUrl = emailResult.previewUrl;
  }

  res.status(201).json({
    success: true,
    message: `Lost report for "${title}" posted! In-process TF-IDF similarity scanning initiated.`,
    lostItem: newLost,
    topMatchesCount: candidateMatches.length,
    matches: candidateMatches.slice(0, 3), // Return top 3 candidates
    emailDispatched,
    emailPreviewUrl
  });
});

// GET /api/lost-items/my-reports
router.get('/my-reports', (req, res) => {
  // Support studentId from query or header, fallback to default student Test Student
  const studentId = req.query.studentId || '2600000';
  const reports = db.getLostItemsByStudentId(studentId);
  const activeFoundItems = db.getAllFoundItems().filter(i => i.status !== 'returned');

  // Enrich each report with current TF-IDF match calculations
  const enrichedReports = reports.map(rep => {
    const matches = findMatches(rep, activeFoundItems);
    return {
      ...rep,
      matchCount: matches.length,
      topMatch: matches.length > 0 ? matches[0] : null,
      candidates: matches.slice(0, 3)
    };
  });

  res.json({
    success: true,
    studentId,
    totalReports: enrichedReports.length,
    reports: enrichedReports
  });
});

// GET /api/lost-items/:id
router.get('/:id', (req, res) => {
  const report = db.getLostItemById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Lost report not found' });
  }

  const activeFoundItems = db.getAllFoundItems().filter(i => i.status !== 'returned');
  const matches = findMatches(report, activeFoundItems);

  res.json({
    success: true,
    report: {
      ...report,
      matches
    }
  });
});

// PATCH /api/lost-items/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = db.updateLostItemStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Lost report not found' });
  }

  res.json({
    success: true,
    message: `Lost report marked as ${status}`,
    report: updated
  });
});

module.exports = router;
