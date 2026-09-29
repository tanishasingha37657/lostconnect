/**
 * routes/claims.js
 * Claim Submissions, Offline Claim Pass Generation & Blind Ownership Challenge
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * Helper to normalize challenge answers for fuzzy comparison
 */
function normalizeAnswer(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// POST /api/claims (Submit Claim & Generate Offline Claim Pass)
router.post('/', (req, res) => {
  const { foundItemId, claimantName, studentId, phone, proofDetails } = req.body;

  if (!foundItemId || !claimantName || !proofDetails) {
    return res.status(400).json({ error: 'foundItemId, claimantName, and proofDetails are required' });
  }

  const foundItem = db.getFoundItemById(foundItemId);
  if (!foundItem) {
    return res.status(404).json({ error: 'Found item not found' });
  }

  const newClaim = db.createClaim({
    foundItemId,
    foundItemTitle: foundItem.title,
    custodyLocation: foundItem.custodyLocation,
    claimantName,
    studentId: studentId || '2600000',
    phone: phone || '+91 98765 43210',
    proofDetails,
    status: 'pending_verification'
  });

  res.status(201).json({
    success: true,
    message: `Claim request submitted for "${foundItem.title}". Offline pass generated!`,
    claim: newClaim,
    offlinePass: {
      claimCode: newClaim.claimCode,
      qrPayload: newClaim.qrPayload,
      studentId: newClaim.studentId,
      custodyDesk: foundItem.custodyLocation,
      instructions: 'Take a screenshot of this Claim Pass. Present your Christ University ID card at Central Block, Room 104 for zero-network physical handover.'
    }
  });
});

// POST /api/claims/challenge/verify (Blind Ownership Challenge API)
router.post('/challenge/verify', (req, res) => {
  const { foundItemId, claimantAnswer, claimantStudentId, claimantName } = req.body;

  if (!foundItemId || !claimantAnswer) {
    return res.status(400).json({ error: 'foundItemId and claimantAnswer are required' });
  }

  const challenge = db.getChallengeByItemId(foundItemId);
  if (!challenge) {
    return res.status(404).json({
      error: 'No blind challenge question registered for this item. Proceed with standard claim.'
    });
  }

  const item = db.getFoundItemById(foundItemId);
  const normalizedAttempt = normalizeAnswer(claimantAnswer);
  const normalizedTarget = normalizeAnswer(challenge.answerNormalized);

  // Check matching: exact match OR target keywords contained in claimant's detailed explanation
  const isMatch = normalizedAttempt === normalizedTarget ||
    normalizedAttempt.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedAttempt);

  if (isMatch) {
    // Automatically generate a pre-approved fast-pass claim
    const fastClaim = db.createClaim({
      foundItemId,
      foundItemTitle: item ? item.title : 'Campus Belonging',
      custodyLocation: item ? item.custodyLocation : 'Central Security Desk',
      claimantName: claimantName || 'Test Student',
      studentId: claimantStudentId || '2600000',
      proofDetails: `Verified via Blind Challenge: "${claimantAnswer}"`,
      status: 'pre_approved_by_challenge',
      challengePassed: true
    });

    return res.json({
      success: true,
      verified: true,
      confidence: 0.98,
      status: 'pre_approved_by_challenge',
      message: 'Blind Ownership Challenge passed! Your claim is pre-approved.',
      claimCode: fastClaim.claimCode,
      qrPayload: fastClaim.qrPayload,
      pickupDesk: item ? item.custodyLocation : 'Central Block Room 104'
    });
  } else {
    return res.json({
      success: false,
      verified: false,
      confidence: 0.15,
      status: 'challenge_failed',
      message: 'Challenge answer did not match. You can still submit manual proof details for security review.'
    });
  }
});

// GET /api/claims/:id/pass (Fetch Claim Pass details)
router.get('/:id/pass', (req, res) => {
  const claim = db.getClaimById(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim pass not found' });
  }

  const item = db.getFoundItemById(claim.foundItemId);

  res.json({
    success: true,
    pass: {
      claimCode: claim.claimCode,
      claimId: claim.id,
      itemTitle: claim.foundItemTitle,
      category: item ? item.category : 'Belonging',
      locationFound: item ? item.location : 'Campus',
      custodyDesk: claim.custodyLocation,
      claimantName: claim.claimantName,
      studentId: claim.studentId,
      qrPayload: claim.qrPayload,
      status: claim.status,
      timestamp: claim.createdAt
    }
  });
});

// GET /api/claims/my-claims
router.get('/my-claims', (req, res) => {
  const studentId = req.query.studentId || '2600000';
  const claims = db.getClaimsByStudentId(studentId);

  res.json({
    success: true,
    total: claims.length,
    claims
  });
});

module.exports = router;
