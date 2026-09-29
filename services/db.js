/**
 * services/db.js
 * In-Memory & File-Backed JSON Datastore for LostConnect
 * Pre-seeded with Christ University campus data and items.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'lostconnect_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data aligned with index.html
const INITIAL_SEED = {
  users: [
    {
      id: 'usr_1',
      name: 'Test Student',
      email: 'test.student@example.com',
      studentId: '2600000',
      role: 'student',
      department: 'School of Sciences (MSAIM)'
    },
    {
      id: 'usr_sec',
      name: 'Central Security Officer',
      email: 'security.desk@christuniversity.in',
      badgeId: 'SEC-ROOM104',
      role: 'security',
      department: 'Campus Safety & Custody'
    }
  ],
  foundItems: [
    {
      id: '1',
      itemCode: 'LC-8921',
      title: 'Apple AirPods Pro (2nd Gen)',
      category: 'electronics',
      location: 'Central Library (3rd Floor Quiet Study Cubicle #34)',
      custodyLocation: 'Central Security Desk (Room 104)',
      status: 'in_custody',
      date: 'Today, 10:15 AM',
      description: 'Found tucked next to charging socket on 6th floor, Central Block, near round tables. The AirPods are enclosed in a white MagSafe case with a thin olive green silicone tether. Serial number recorded securely by security officer.',
      sanitized: true,
      hasChallenge: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      itemCode: 'LC-8919',
      title: 'Christ University Student ID Card',
      category: 'documents',
      location: 'Block IV Cafeteria (Table 12 near salad bar)',
      custodyLocation: 'Block IV Reception Desk',
      status: 'at_reception',
      date: 'Today, 12:45 PM',
      description: "Official smart student ID card issued for the School of Arts & Humanities. Found lying on table 12 after lunch hours. Initials: 'R. K.', Department of Psychology, year 2024-2027.",
      sanitized: true,
      hasChallenge: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      itemCode: 'LC-8915',
      title: 'Matte Olive Hydro Flask (32oz)',
      category: 'accessories',
      location: 'Audi Block Ground Floor Lobby',
      custodyLocation: 'Audi Desk',
      status: 'in_custody',
      date: 'Today, 09:30 AM',
      description: 'Olive green thermal hydration flask with black loop handle and straw mouth. Features a small holographic coding sticker ("404 Brain Not Found") and minor scrape on the bottom base.',
      sanitized: true,
      hasChallenge: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      itemCode: 'LC-8912',
      title: 'Casio fx-991CW Scientific Calculator',
      category: 'academic',
      location: 'Engineering Lab 204',
      custodyLocation: 'Engineering Lab Assistant',
      status: 'in_custody',
      date: 'Yesterday, 04:30 PM',
      description: 'Standard engineering non-programmable scientific calculator. Has protective hard sliding cover. Clean condition with fresh battery.',
      sanitized: true,
      hasChallenge: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      itemCode: 'LC-8908',
      title: 'Hostel Keys with Leather Tag',
      category: 'keys',
      location: 'Sports Complex (Court B Bleachers)',
      custodyLocation: 'Security Main Post',
      status: 'in_custody',
      date: 'Yesterday, 06:15 PM',
      description: "Ring with 3 brass door/wardrobe keys and an olive leather rectangular fob embossed with '#308'. Found after evening badminton practice.",
      sanitized: true,
      hasChallenge: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      itemCode: 'LC-8901',
      title: 'Charcoal Grey Laptop Backpack',
      category: 'bags',
      location: 'Central Block (2nd Floor Staircase)',
      custodyLocation: 'Central Security Desk (Room 104)',
      status: 'in_custody',
      date: '2 days ago, 02:00 PM',
      description: 'Durable water-resistant backpack containing university lecture spiral notebooks, pens, and an umbrella in the side pocket. No identity card found inside.',
      sanitized: true,
      hasChallenge: false,
      createdAt: new Date().toISOString()
    }
  ],
  lostItems: [
    {
      id: 'lost_1',
      title: 'Apple Pencil (2nd Gen)',
      category: 'electronics',
      approxLocation: 'Central Library 2nd Floor',
      lostDateTime: 'Yesterday, 03:00 PM',
      contactEmail: 'test.student@example.com',
      studentId: '2600000',
      description: 'White Apple Pencil with personalized engraved initials "TS" on the magnetic flat side.',
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: 'lost_2',
      title: 'Tan Leather Cardholder',
      category: 'documents',
      approxLocation: 'Audi Block Ground Floor',
      lostDateTime: '2 days ago, 11:30 AM',
      contactEmail: 'test.student@example.com',
      studentId: '2600000',
      description: 'Small tan leather cardholder containing metro card and cafeteria reload pass.',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ],
  challenges: [
    {
      id: 'chal_1',
      foundItemId: '1', // AirPods Pro
      prompt: 'What color is the silicone tether strap attached to the white MagSafe charging case?',
      answerNormalized: 'olive green'
    },
    {
      id: 'chal_3',
      foundItemId: '3', // Hydro flask
      prompt: 'What specific text or slogan is written on the sticker attached to the bottle?',
      answerNormalized: '404 brain not found'
    }
  ],
  claims: []
};

// Load or write initial DB
let dbData = { ...INITIAL_SEED };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbData = JSON.parse(raw);
    } else {
      saveDB();
    }
  } catch (err) {
    console.error('Error loading DB file, falling back to in-memory seed:', err);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB file:', err);
  }
}

// Initial load
loadDB();

module.exports = {
  get: () => dbData,
  save: saveDB,

  // Users
  getUserByEmail: (email) => dbData.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  getUserByStudentId: (id) => dbData.users.find(u => u.studentId === id),
  createUser: (user) => {
    user.id = 'usr_' + Date.now();
    dbData.users.push(user);
    saveDB();
    return user;
  },

  // Found Items
  getAllFoundItems: () => dbData.foundItems,
  getFoundItemById: (id) => dbData.foundItems.find(i => String(i.id) === String(id) || i.itemCode === id),
  createFoundItem: (item) => {
    item.id = String(dbData.foundItems.length + 1);
    item.itemCode = `LC-${Math.floor(1000 + Math.random() * 9000)}`;
    item.status = item.status || 'in_custody';
    item.createdAt = new Date().toISOString();
    dbData.foundItems.unshift(item);
    saveDB();
    return item;
  },
  updateFoundItemStatus: (id, status) => {
    const item = dbData.foundItems.find(i => String(i.id) === String(id) || i.itemCode === id);
    if (item) {
      item.status = status;
      saveDB();
    }
    return item;
  },

  // Lost Items
  getAllLostItems: () => dbData.lostItems,
  getLostItemById: (id) => dbData.lostItems.find(i => String(i.id) === String(id)),
  getLostItemsByStudentId: (studentId) => dbData.lostItems.filter(i => i.studentId === studentId),
  createLostItem: (item) => {
    item.id = 'lost_' + Date.now();
    item.status = 'active';
    item.createdAt = new Date().toISOString();
    dbData.lostItems.unshift(item);
    saveDB();
    return item;
  },
  updateLostItemStatus: (id, status) => {
    const item = dbData.lostItems.find(i => String(i.id) === String(id));
    if (item) {
      item.status = status;
      saveDB();
    }
    return item;
  },

  // Blind Ownership Challenges
  getChallengeByItemId: (foundItemId) => dbData.challenges.find(c => String(c.foundItemId) === String(foundItemId)),
  createChallenge: (challenge) => {
    challenge.id = 'chal_' + Date.now();
    challenge.answerNormalized = challenge.answer.toLowerCase().trim();
    dbData.challenges.push(challenge);
    saveDB();
    return challenge;
  },

  // Claims
  getAllClaims: () => dbData.claims,
  getClaimById: (id) => dbData.claims.find(c => c.id === id || c.claimCode === id),
  getClaimsByStudentId: (studentId) => dbData.claims.filter(c => c.studentId === studentId),
  createClaim: (claim) => {
    claim.id = 'claim_' + Date.now();
    claim.claimCode = `LC-CLAIM-${Math.floor(1000 + Math.random() * 9000)}`;
    claim.status = claim.status || 'pending_verification';
    claim.createdAt = new Date().toISOString();
    // Static QR string payload for offline decoding
    claim.qrPayload = `LOSTCONNECT:${claim.claimCode}:${claim.studentId}:${claim.foundItemId}`;
    dbData.claims.unshift(claim);
    saveDB();
    return claim;
  },
  updateClaimHandover: (claimId, officerNotes, officerBadge) => {
    const claim = dbData.claims.find(c => c.id === claimId || c.claimCode === claimId);
    if (claim) {
      claim.status = 'handed_over';
      claim.handedOverAt = new Date().toISOString();
      claim.officerNotes = officerNotes;
      claim.officerBadge = officerBadge || 'SEC-ROOM104';

      // Also update associated found item to returned
      const item = dbData.foundItems.find(i => String(i.id) === String(claim.foundItemId));
      if (item) {
        item.status = 'returned';
      }
      saveDB();
    }
    return claim;
  }
};
