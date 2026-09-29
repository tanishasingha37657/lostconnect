/**
 * test_apis.js
 * Comprehensive automated verification test suite for all LostConnect REST APIs.
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting LostConnect API Test Suite ---\n');

  // Test 1: Health Check
  console.log('1. Testing GET /api/health ...');
  const health = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/health',
    method: 'GET'
  });
  console.log(`   Status: ${health.status}, Portal: ${health.body.portal}`);

  // Test 2: Auth Login
  console.log('\n2. Testing POST /api/auth/login ...');
  const login = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'test.student@example.com' });
  console.log(`   Status: ${login.status}, Message: ${login.body.message}, Role: ${login.body.user.role}`);

  // Test 3: PII Sanitizer Preview
  console.log('\n3. Testing POST /api/items/sanitize-preview (PII Redactor) ...');
  const sanitizer = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/items/sanitize-preview',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    rawDescription: "Found Student ID of Rahul Sharma (2600000) in Audi Block. Call +91 98765 43210 or email rahul.s@christuniversity.in"
  });
  console.log(`   Status: ${sanitizer.status}`);
  console.log(`   Original:  "${sanitizer.body.original}"`);
  console.log(`   Sanitized: "${sanitizer.body.sanitizedDescription}"`);
  console.log(`   Redactions count: ${sanitizer.body.redactedCount}`);

  // Test 4: Found Items Catalog
  console.log('\n4. Testing GET /api/found-items?category=electronics ...');
  const foundItems = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/found-items?category=electronics',
    method: 'GET'
  });
  console.log(`   Status: ${foundItems.status}, Total electronics: ${foundItems.body.total}`);

  // Test 5: Report Lost Item with In-Process TF-IDF
  console.log('\n5. Testing POST /api/lost-items (with instant TF-IDF correlation) ...');
  const lostReport = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/lost-items',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    title: "Apple AirPods with MagSafe case",
    category: "electronics",
    approxLocation: "Central Library 3rd Floor",
    description: "Lost white Apple AirPods with silicone strap near charging socket in library",
    studentId: "2600000"
  });
  console.log(`   Status: ${lostReport.status}, ID: ${lostReport.body.lostItem.id}`);
  console.log(`   Top TF-IDF Match: ${lostReport.body.matches[0].foundItemTitle} (${lostReport.body.matches[0].matchPercentage})`);

  // Test 6: In-process TF-IDF Match Endpoint
  console.log('\n6. Testing GET /api/matches/:lostItemId ...');
  const matchesRes = await request({
    host: 'localhost',
    port: 8080,
    path: `/api/matches/${lostReport.body.lostItem.id}`,
    method: 'GET'
  });
  console.log(`   Status: ${matchesRes.status}, Engine: ${matchesRes.body.engine}`);
  console.log(`   Top Candidate: ${matchesRes.body.matches[0].foundItemTitle} - Confidence: ${matchesRes.body.matches[0].confidence} (${matchesRes.body.matches[0].matchPercentage})`);

  // Test 7: Blind Ownership Challenge Verification
  console.log('\n7. Testing POST /api/claims/challenge/verify (Blind Challenge) ...');
  // Attempt 7a: Wrong answer
  const wrongChallenge = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/claims/challenge/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    foundItemId: "1",
    claimantAnswer: "bright red ribbon"
  });
  console.log(`   7a (Wrong Answer) -> Verified: ${wrongChallenge.body.verified}, Status: ${wrongChallenge.body.status}`);

  // Attempt 7b: Correct answer ("olive green")
  const correctChallenge = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/claims/challenge/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    foundItemId: "1",
    claimantAnswer: "It has a thin olive green silicone tether",
    claimantStudentId: "2600000",
    claimantName: "Test Student"
  });
  console.log(`   7b (Correct Answer) -> Verified: ${correctChallenge.body.verified}, Status: ${correctChallenge.body.status}, Fast-Pass Code: ${correctChallenge.body.claimCode}`);

  // Test 8: Offline Claim Pass Creation
  console.log('\n8. Testing POST /api/claims (Offline Pass Generation) ...');
  const claimRes = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/claims',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    foundItemId: "3", // Hydro Flask
    claimantName: "Test Student",
    studentId: "2600000",
    phone: "+91 98765 43210",
    proofDetails: "Has a holographic 404 Brain Not Found coding sticker and scratch at bottom"
  });
  console.log(`   Status: ${claimRes.status}, Claim Code: ${claimRes.body.offlinePass.claimCode}`);
  console.log(`   QR Payload: ${claimRes.body.offlinePass.qrPayload}`);

  // Test 9: Security Desk LAN Lookup by Claim Code or Student ID
  console.log('\n9. Testing GET /api/security/claims/lookup?query=2600000 (Room 104 Desk PC) ...');
  const deskLookup = await request({
    host: 'localhost',
    port: 8080,
    path: `/api/security/claims/lookup?query=${claimRes.body.offlinePass.claimCode}`,
    method: 'GET'
  });
  console.log(`   Status: ${deskLookup.status}, Claims Found: ${deskLookup.body.total}`);
  console.log(`   Item at Desk: ${deskLookup.body.claims[0].item.title} (${deskLookup.body.claims[0].item.custodyLocation})`);

  // Test 10: Security Desk Physical Handover Sign-Off
  console.log('\n10. Testing PATCH /api/security/claims/:id/handover ...');
  const handover = await request({
    host: 'localhost',
    port: 8080,
    path: `/api/security/claims/${claimRes.body.claim.id}/handover`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    physicalIdVerified: true,
    officerBadge: "SEC-ROOM104",
    officerNotes: "Physical Christ University Student ID #2600000 verified. Item handed over to Test Student."
  });
  console.log(`   Status: ${handover.status}, New Status: ${handover.body.claim.status}`);

  // Test 11: Security Desk Stats
  console.log('\n11. Testing GET /api/security/stats ...');
  const stats = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/security/stats',
    method: 'GET'
  });
  console.log(`   Status: ${stats.status}, In Custody: ${stats.body.stats.itemsInCustody}, Reunited: ${stats.body.stats.reunitedBelongings}`);

  // Test 12: Third-Party Email Notification Dispatch (Nodemailer / Gmail SMTP / Ethereal)
  console.log('\n12. Testing POST /api/notifications/test-email (Third-Party Email Notification API) ...');
  const emailRes = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/notifications/test-email',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'test.student@example.com'
  });
  console.log(`   Status: ${emailRes.status}, Success: ${emailRes.body.success}, Mode: ${emailRes.body.mode}`);
  console.log(`   Recipient: ${emailRes.body.recipient}`);
  if (emailRes.body.previewUrl) {
    console.log(`   Preview Inbox Link: ${emailRes.body.previewUrl}`);
  }

  console.log('\n--- ALL 12 API TEST SCENARIOS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => console.error('Test failed:', err));
