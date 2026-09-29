/**
 * services/matcher.js
 * In-Process TF-IDF Vector Similarity & Campus Proximity Engine
 * Correlates lost item reports with found items in custody.
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'found', 'lost', 'item', 'campus', 'yesterday', 'today'
]);

const CAMPUS_ZONES = [
  'central library', 'library',
  'block iv', 'block 4',
  'audi block', 'auditorium',
  'engineering block', 'lab 204',
  'sports complex', 'badminton',
  'central block'
];

/**
 * Tokenize and normalize text into clean words
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Calculate Term Frequency (TF) for a document
 */
function calculateTF(tokens) {
  const tf = {};
  if (!tokens || tokens.length === 0) return tf;
  
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  for (const token in tf) {
    tf[token] = tf[token] / tokens.length;
  }
  return tf;
}

/**
 * Compute Cosine Similarity between two TF-IDF vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const key in vecA) {
    const valA = vecA[key];
    const valB = vecB[key] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
  }

  for (const key in vecB) {
    const valB = vecB[key];
    magB += valB * valB;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Checks if two campus locations share the same zone
 */
function checkLocationProximity(locA, locB) {
  if (!locA || !locB) return false;
  const a = locA.toLowerCase();
  const b = locB.toLowerCase();
  return CAMPUS_ZONES.some(zone => a.includes(zone) && b.includes(zone));
}

/**
 * Matches a lost item against a list of found items
 * @param {object} lostItem 
 * @param {Array<object>} foundItemsList 
 * @returns {Array<object>} sorted candidate matches with similarity score
 */
function findMatches(lostItem, foundItemsList) {
  if (!lostItem || !Array.isArray(foundItemsList)) return [];

  const lostDocText = `${lostItem.title} ${lostItem.category} ${lostItem.description || ''} ${lostItem.approxLocation || ''}`;
  const lostTokens = tokenize(lostDocText);

  // Build corpus of all documents to compute Document Frequency (DF)
  const allDocs = foundItemsList.map(item => ({
    item,
    tokens: tokenize(`${item.title} ${item.category} ${item.description || ''} ${item.location || ''}`)
  }));

  const N = allDocs.length + 1;
  const df = {};

  // Count document frequencies
  for (const doc of [...allDocs, { tokens: lostTokens }]) {
    const uniqueTokens = new Set(doc.tokens);
    for (const token of uniqueTokens) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  // Calculate TF-IDF vector for lost item
  const lostTF = calculateTF(lostTokens);
  const lostVec = {};
  for (const token in lostTF) {
    const idf = Math.log(1 + (N / (df[token] || 1))) + 1;
    lostVec[token] = lostTF[token] * idf;
  }

  // Match against each found item
  const results = [];

  for (const doc of allDocs) {
    const foundItem = doc.item;

    // Rule 1: Category Constraint (Category MUST match or belong to similar group)
    const categoryMatch = lostItem.category && foundItem.category &&
      lostItem.category.toLowerCase().trim() === foundItem.category.toLowerCase().trim();

    if (!categoryMatch) {
      continue; // Skip items from completely different categories
    }

    // Compute TF-IDF vector for found item
    const foundTF = calculateTF(doc.tokens);
    const foundVec = {};
    for (const token in foundTF) {
      const idf = Math.log(1 + (N / (df[token] || 1))) + 1;
      foundVec[token] = foundTF[token] * idf;
    }

    // Base TF-IDF cosine similarity
    let score = cosineSimilarity(lostVec, foundVec);

    // Rule 2: Campus Location Proximity Bonus
    const sameZone = checkLocationProximity(lostItem.approxLocation, foundItem.location);
    if (sameZone) {
      score = Math.min(1.0, score + 0.12);
    }

    // Normalization & thresholding
    if (score >= 0.25) {
      const percentage = Math.round(score * 100);
      let confidence = 'low';
      if (percentage >= 80) confidence = 'high';
      else if (percentage >= 50) confidence = 'medium';

      results.push({
        foundItemId: foundItem.id,
        foundItemTitle: foundItem.title,
        category: foundItem.category,
        location: foundItem.location,
        custodyStatus: foundItem.custodyStatus || foundItem.status,
        date: foundItem.date,
        photoUrl: foundItem.photoUrl || foundItem.image,
        description: foundItem.description,
        score: Number(score.toFixed(3)),
        matchPercentage: `${percentage}%`,
        confidence,
        sameZoneMatch: sameZone
      });
    }
  }

  // Sort descending by match score
  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = {
  tokenize,
  cosineSimilarity,
  findMatches
};
