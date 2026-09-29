/**
 * services/email.js
 * Third-Party Email Notification Service for LostConnect
 * Integrates with Gmail SMTP (with automatic Ethereal test inbox fallback for evaluations/dev).
 */

const nodemailer = require('nodemailer');

let cachedTransporter = null;
let isEthereal = false;

/**
 * Initializes or retrieves the active Nodemailer transporter
 */
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;

  if (gmailUser && gmailPass) {
    // Production / Real Gmail Mode
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });
    isEthereal = false;
    console.log(`[Email Service] Configured with real Gmail account: ${gmailUser}`);
  } else {
    // Development / Viva Demo Mode: Zero-config Ethereal account
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    isEthereal = true;
    console.log('[Email Service] Running in demo mode (Ethereal test inbox active with live preview URLs).');
  }

  return cachedTransporter;
}

/**
 * Generates branded HTML email for a strong potential match
 */
function buildMatchEmailHTML({ studentName, lostItem, matchedFoundItem, matchPercentage }) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F4EC; color: #232B25; margin: 0; padding: 24px; }
      .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #E4DAC7; box-shadow: 0 4px 20px rgba(45, 68, 50, 0.08); }
      .header { background: #2D4432; color: #FCFAF6; padding: 28px 32px; text-align: center; }
      .badge { display: inline-block; background: #698F6F; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 10px; }
      .title { font-size: 22px; font-weight: 800; margin: 0; }
      .content { padding: 32px; }
      .match-banner { background: #E7EFE8; border: 1px solid #B5CEB8; border-radius: 14px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
      .match-score { font-size: 26px; font-weight: 800; color: #2D4432; }
      .details-grid { background: #FCFAF6; border: 1px solid #EFE8DC; border-radius: 14px; padding: 18px; margin-bottom: 24px; }
      .detail-row { margin-bottom: 10px; font-size: 13px; line-height: 1.5; }
      .detail-label { font-weight: 700; color: #526056; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
      .btn { display: block; background: #527558; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; margin-top: 20px; }
      .footer { background: #F8F4EC; padding: 18px 32px; font-size: 11px; color: #718276; text-align: center; border-top: 1px solid #E4DAC7; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <div class="badge">LostConnect &bull; Christ University</div>
        <h1 class="title">Potential Match Detected!</h1>
      </div>
      <div class="content">
        <p>Dear <strong>${studentName || 'Student'}</strong>,</p>
        <p>Our in-process TF-IDF algorithm has detected a high-confidence match for the belonging you reported lost.</p>

        <div class="match-banner">
          <div>
            <div style="font-size: 12px; font-weight: bold; color: #527558; text-transform: uppercase;">Confidence Score</div>
            <div style="font-size: 14px; color: #38433B;">High AI Similarity Rating</div>
          </div>
          <div class="match-score">${matchPercentage}</div>
        </div>

        <div class="details-grid">
          <div class="detail-row">
            <span class="detail-label">Your Reported Item:</span><br>
            <strong>${lostItem.title}</strong> (${lostItem.category || 'General'}) &bull; Lost near ${lostItem.approxLocation || 'Campus'}
          </div>
          <hr style="border: 0; border-top: 1px dashed #E4DAC7; margin: 12px 0;">
          <div class="detail-row">
            <span class="detail-label">Cataloged Found Item:</span><br>
            <strong>${matchedFoundItem.title}</strong>
          </div>
          <div class="detail-row">
            <span class="detail-label">Current Custody Location:</span><br>
            ${matchedFoundItem.custodyLocation || matchedFoundItem.location || 'Central Security Desk (Room 104)'}
          </div>
          <div class="detail-row">
            <span class="detail-label">Description Snippet:</span><br>
            <em>"${matchedFoundItem.description || 'Verified in campus custody'}"</em>
          </div>
        </div>

        <p style="font-size: 13px; color: #526056; line-height: 1.5;">
          <strong>Next Steps:</strong> Visit <strong>Central Block, Ground Floor, Room 104</strong> or click below to review the claim pass and verify proof of ownership.
        </p>

        <a href="http://localhost:8080/#my-reports" class="btn">View &amp; Claim Item on LostConnect</a>
      </div>
      <div class="footer">
        LostConnect &bull; Automated Campus Recovery System &bull; Christ (Deemed to be University)<br>
        Room 104, Central Block &bull; security.lostfound@christuniversity.in
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Dispatches a match notification email
 * @param {object} params
 * @returns {Promise<object>} { success, previewUrl, messageId, mode }
 */
async function sendMatchNotificationEmail({
  recipientEmail,
  studentName = 'Test Student',
  lostItem,
  matchedFoundItem,
  matchScore,
  matchPercentage
}) {
  try {
    const transporter = await getTransporter();
    const fromAddress = process.env.GMAIL_USER || '"LostConnect Campus Desk" <notifications@lostconnect.christuniversity.in>';
    const to = recipientEmail || 'test.student@example.com';
    const pct = matchPercentage || `${Math.round(matchScore * 100)}%`;

    const htmlContent = buildMatchEmailHTML({
      studentName,
      lostItem,
      matchedFoundItem,
      matchPercentage: pct
    });

    const mailOptions = {
      from: fromAddress,
      to,
      subject: `[LostConnect Alert] Potential Match Found for Your ${lostItem.title} (${pct} Match)`,
      text: `Great news! We found a potential match (${pct}) for your lost item "${lostItem.title}". It is currently held at ${matchedFoundItem.custodyLocation || matchedFoundItem.location}. Visit Central Block Room 104 to claim it.`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;

    console.log(`[Email Dispatched] To: ${to} | Subject: "${mailOptions.subject}"`);
    if (previewUrl) {
      console.log(`[Email Preview Link (Click to view)] 👉 ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      mode: isEthereal ? 'ethereal_preview' : 'gmail_smtp',
      recipient: to
    };
  } catch (err) {
    console.error('[Email Dispatch Error]:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Quick test email sender
 */
async function sendTestEmail(targetEmail) {
  return sendMatchNotificationEmail({
    recipientEmail: targetEmail || 'test.student@example.com',
    studentName: 'Test Student',
    lostItem: {
      title: 'Apple AirPods Pro',
      category: 'Electronics',
      approxLocation: 'Central Library 3rd Floor'
    },
    matchedFoundItem: {
      title: 'Apple AirPods Pro (2nd Gen)',
      location: 'Central Library Quiet Study',
      custodyLocation: 'Central Security Desk (Room 104)',
      description: 'Found tucked next to charging socket in white MagSafe case.'
    },
    matchScore: 0.94,
    matchPercentage: '94%'
  });
}

module.exports = {
  sendMatchNotificationEmail,
  sendTestEmail
};
