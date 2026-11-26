const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { User, FoundItem, LostItem, Challenge, Claim } = require('./models');

const seedPath = path.join(__dirname, '..', 'data', 'seed.json');

function serialize(record) {
  if (!record) return null;
  const { _id, __v, ...fields } = record;
  return { ...fields, id: String(_id) };
}

function idFor(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function claimCode() {
  return `LC-CLAIM-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function seedCollection(Model, records) {
  if (await Model.exists({})) return;
  if (records.length === 0) return;
  await Model.insertMany(records.map(({ id, ...record }) => ({ ...record, _id: String(id) })));
}

async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lostconnect';
  await mongoose.connect(uri);

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  await Promise.all([
    seedCollection(User, seed.users || []),
    seedCollection(FoundItem, seed.foundItems || []),
    seedCollection(LostItem, seed.lostItems || []),
    seedCollection(Challenge, seed.challenges || []),
    seedCollection(Claim, seed.claims || [])
  ]);
}

async function findItem(Model, id, fields = {}) {
  const key = String(id);
  const record = await Model.findOne({
    $or: [{ _id: key }, ...(fields.itemCode ? [{ itemCode: key }] : [])]
  }).lean();
  return serialize(record);
}

async function updateStatus(Model, id, status, fields = {}) {
  const key = String(id);
  const record = await Model.findOneAndUpdate(
    { $or: [{ _id: key }, ...(fields.itemCode ? [{ itemCode: key }] : [])] },
    { $set: { status } },
    { new: true, runValidators: true }
  ).lean();
  return serialize(record);
}

async function createRecord(Model, prefix, record) {
  const saved = await new Model({ ...record, _id: idFor(prefix) }).save();
  return serialize(saved.toObject());
}

module.exports = {
  connect,
  mongoose,

  getUserByEmail: async email => serialize(await User.findOne({ email: email.toLowerCase().trim() }).lean()),
  getUserByStudentId: async id => serialize(await User.findOne({ studentId: String(id) }).lean()),
  createUser: user => createRecord(User, 'usr', { ...user, email: user.email.toLowerCase().trim() }),

  getAllFoundItems: async () => (await FoundItem.find().sort({ createdAt: -1 }).lean()).map(serialize),
  getFoundItemById: id => findItem(FoundItem, id, { itemCode: true }),
  createFoundItem: item => createRecord(FoundItem, 'found', {
    ...item,
    itemCode: item.itemCode || `LC-${Math.floor(1000 + Math.random() * 9000)}`,
    status: item.status || 'in_custody',
    createdAt: item.createdAt || new Date().toISOString()
  }),
  updateFoundItemStatus: (id, status) => updateStatus(FoundItem, id, status, { itemCode: true }),

  getAllLostItems: async () => (await LostItem.find().sort({ createdAt: -1 }).lean()).map(serialize),
  getLostItemById: id => findItem(LostItem, id),
  getLostItemsByStudentId: async studentId =>
    (await LostItem.find({ studentId: String(studentId) }).sort({ createdAt: -1 }).lean()).map(serialize),
  createLostItem: item => createRecord(LostItem, 'lost', {
    ...item,
    status: item.status || 'active',
    createdAt: item.createdAt || new Date().toISOString()
  }),
  updateLostItemStatus: (id, status) => updateStatus(LostItem, id, status),

  getChallengeByItemId: async foundItemId =>
    serialize(await Challenge.findOne({ foundItemId: String(foundItemId) }).lean()),
  createChallenge: challenge => {
    const { answer, ...fields } = challenge;
    return createRecord(Challenge, 'chal', {
      ...fields,
      answerNormalized: answer.toLowerCase().trim()
    });
  },

  getAllClaims: async () => (await Claim.find().sort({ createdAt: -1 }).lean()).map(serialize),
  getClaimById: async id => {
    const key = String(id);
    return serialize(await Claim.findOne({ $or: [{ _id: key }, { claimCode: key }] }).lean());
  },
  getClaimsByStudentId: async studentId =>
    (await Claim.find({ studentId: String(studentId) }).sort({ createdAt: -1 }).lean()).map(serialize),
  createClaim: async claim => {
    const code = claim.claimCode || claimCode();
    return createRecord(Claim, 'claim', {
      ...claim,
      claimCode: code,
      status: claim.status || 'pending_verification',
      createdAt: claim.createdAt || new Date().toISOString(),
      qrPayload: claim.qrPayload || `LOSTCONNECT:${code}:${claim.studentId}:${claim.foundItemId}`
    });
  },
  updateClaimHandover: async (claimId, officerNotes, officerBadge) => {
    const key = String(claimId);
    const claim = await Claim.findOneAndUpdate(
      { $or: [{ _id: key }, { claimCode: key }] },
      {
        $set: {
          status: 'handed_over',
          handedOverAt: new Date().toISOString(),
          officerNotes,
          officerBadge: officerBadge || 'SEC-ROOM104'
        }
      },
      { new: true, runValidators: true }
    ).lean();
    if (!claim) return null;
    await FoundItem.findByIdAndUpdate(claim.foundItemId, { $set: { status: 'returned' } });
    return serialize(claim);
  }
};
