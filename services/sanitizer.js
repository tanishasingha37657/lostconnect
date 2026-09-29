/**
 * services/sanitizer.js
 * Automated PII Redactor & Sanitizer for LostConnect
 * Protects student privacy by masking personal identifiable info before public listing.
 */

// Regex patterns for campus PII
const PATTERNS = {
  // 10-digit Indian mobile numbers with optional country code (+91, 0) and optional spaces/dashes
  phone: /(?:(?:\+91|0)?[ -]?)?([6-9]\d{4})[ -]?(\d{5})/g,
  
  // Christ University student / staff 7-digit ID numbers (e.g. 2600000, #2341098)
  studentId: /(?:#|\bID:?\s*|\bRegister(?:\s*No\.?)?:?\s*)?(\b\d{3})(\d{4}\b)/gi,
  
  // University emails (e.g. name@*.christuniversity.in)
  email: /([a-zA-Z0-9._%+-]{1,3})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  
  // Explicit name labels: "Name: Rahul Sharma", "Initials/Student: John Doe"
  labeledName: /(?:name|student|owner)\s*[:=-]\s*['"]?([A-Z][a-z]+)\s+([A-Z][a-z]+)['"]?/gi
};

/**
 * Converts a two-word name to initials (e.g. "Rahul Kumar" -> "R. K.")
 */
function toInitials(firstName, lastName) {
  return `${firstName[0].toUpperCase()}. ${lastName[0].toUpperCase()}.`;
}

/**
 * Sanitizes input text by redacting sensitive student PII
 * @param {string} text 
 * @returns {object} { original, sanitized, redactedCount, redactions }
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return { original: '', sanitized: '', redactedCount: 0, redactions: [] };
  }

  let sanitized = text;
  const redactions = [];

  // 1. Redact Phone Numbers (keep first 2 digits and last 2 digits, mask middle)
  sanitized = sanitized.replace(PATTERNS.phone, (match, prefix, suffix) => {
    redactions.push({ type: 'phone_number', original: match });
    return `+91 ***** ${suffix.slice(-2)}`;
  });

  // 2. Redact Student Registration / ID Numbers (e.g., 2600000 -> #260****)
  sanitized = sanitized.replace(PATTERNS.studentId, (match, p1, p2) => {
    // Avoid masking general years like 2024 or 2026
    const num = (p1 + p2);
    if (num.length === 7) {
      redactions.push({ type: 'student_id', original: match });
      return `#${p1}****`;
    }
    return match;
  });

  // 3. Redact Emails (e.g., test.student@example.com -> t***@example.com)
  sanitized = sanitized.replace(PATTERNS.email, (match, prefix, domain) => {
    redactions.push({ type: 'email', original: match });
    return `${prefix}***${domain}`;
  });

  // 4. Redact Labeled Names to Initials (e.g. "Name: Rahul Kumar" -> "Initials: R. K.")
  sanitized = sanitized.replace(PATTERNS.labeledName, (match, first, last) => {
    const initials = toInitials(first, last);
    redactions.push({ type: 'student_name', original: `${first} ${last}`, initials });
    return `Initials: ${initials}`;
  });

  return {
    original: text,
    sanitized,
    redactedCount: redactions.length,
    redactions
  };
}

module.exports = {
  sanitizeText
};
