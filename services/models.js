const mongoose = require('mongoose');

const schemaOptions = {
  strict: false,
  versionKey: false,
  minimize: false
};

function createSchema(fields) {
  return new mongoose.Schema({ _id: String, ...fields }, schemaOptions);
}

const User = mongoose.model('User', createSchema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  studentId: String,
  role: String,
  department: String,
  badgeId: String
}), 'users');

const FoundItem = mongoose.model('FoundItem', createSchema({
  itemCode: String,
  title: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  custodyLocation: String,
  status: String,
  description: String,
  photoUrl: String
}), 'foundItems');

const LostItem = mongoose.model('LostItem', createSchema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  approxLocation: { type: String, required: true },
  contactEmail: String,
  studentId: String,
  description: String,
  status: String,
  photoUrl: String
}), 'lostItems');

const Challenge = mongoose.model('Challenge', createSchema({
  foundItemId: { type: String, required: true },
  prompt: { type: String, required: true },
  answerNormalized: { type: String, required: true }
}), 'challenges');

const Claim = mongoose.model('Claim', createSchema({
  foundItemId: { type: String, required: true },
  claimCode: { type: String, required: true },
  claimantName: { type: String, required: true },
  studentId: String,
  status: String
}), 'claims');

module.exports = { User, FoundItem, LostItem, Challenge, Claim };
