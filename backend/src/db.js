const { MongoClient, ObjectId } = require('mongodb');
const { readStore } = require('./store');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  'mongodb+srv://jbeilyouth:Jbei%3B.Youth%40205@lrcy-jbeil.9ot10nr.mongodb.net/?appName=LRCY-JBEIL';
const DATABASE_NAME = process.env.MONGO_DB_NAME || 'Central_Website';

let client;
let database;

const REQUIRED_COLLECTIONS = [
  'users',
  'birthdays',
  'blood_donors',
  'donation_locations',
  'presentation_topics',
  'presentation_slots',
  'presentation_bookings',
  'presentation_criteria',
  'presentation_evaluations'
];

function getDb() {
  if (!database) {
    throw new Error('MongoDB connection has not been initialized');
  }

  return database;
}

function usersCollection() {
  return getDb().collection('users');
}

function birthdaysCollection() {
  return getDb().collection('birthdays');
}

function bloodDonorsCollection() {
  return getDb().collection('blood_donors');
}

function donationLocationsCollection() {
  return getDb().collection('donation_locations');
}

function presentationTopicsCollection() {
  return getDb().collection('presentation_topics');
}

function presentationSlotsCollection() {
  return getDb().collection('presentation_slots');
}

function presentationBookingsCollection() {
  return getDb().collection('presentation_bookings');
}

function presentationCriteriaCollection() {
  return getDb().collection('presentation_criteria');
}

function presentationEvaluationsCollection() {
  return getDb().collection('presentation_evaluations');
}

function now() {
  return new Date();
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function ensureCollections() {
  const existing = new Set(
    (await getDb().listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
  );

  for (const name of REQUIRED_COLLECTIONS) {
    if (!existing.has(name)) {
      await getDb().createCollection(name);
    }
  }
}

async function ensureIndexes() {
  const evaluationIndexes = await presentationEvaluationsCollection().indexes();
  const legacyAttemptIndexes = evaluationIndexes.filter(
    (index) =>
      index.unique === true &&
      Object.prototype.hasOwnProperty.call(index.key || {}, 'presenterUserId') &&
      !Object.prototype.hasOwnProperty.call(index.key || {}, 'evaluatorUserId')
  );

  for (const legacyIndex of legacyAttemptIndexes) {
    await presentationEvaluationsCollection().dropIndex(legacyIndex.name);
  }

  await Promise.all([
    usersCollection().createIndex({ username: 1 }, { unique: true }),
    birthdaysCollection().createIndex({ normalizedName: 1, birthdate: 1 }, { unique: true }),
    birthdaysCollection().createIndex({ userId: 1 }),
    bloodDonorsCollection().createIndex({ userId: 1 }),
    bloodDonorsCollection().createIndex({ normalizedFullName: 1 }),
    bloodDonorsCollection().createIndex({ normalizedPhoneNumber: 1 }),
    bloodDonorsCollection().createIndex({ location: 1 }),
    bloodDonorsCollection().createIndex({ nextEligibleDonationDate: 1 }),
    donationLocationsCollection().createIndex({ normalizedName: 1 }, { unique: true }),
    donationLocationsCollection().createIndex({ active: 1, name: 1 }),
    presentationTopicsCollection().createIndex({ isAssigned: 1, createdAt: 1 }),
    presentationTopicsCollection().createIndex({ assignedTo: 1 }),
    presentationSlotsCollection().createIndex({ startAt: 1 }, { unique: true }),
    presentationSlotsCollection().createIndex({ isActive: 1, startAt: 1 }),
    presentationBookingsCollection().createIndex({ userId: 1 }, { unique: true }),
    presentationBookingsCollection().createIndex({ slotId: 1 }),
    presentationCriteriaCollection().createIndex({ order: 1 }, { unique: true }),
    presentationCriteriaCollection().createIndex({ isActive: 1, order: 1 }),
    presentationEvaluationsCollection().createIndex(
      { presenterUserId: 1, evaluatorUserId: 1, attempt: 1 },
      { unique: true, name: 'presenterUserId_1_evaluatorUserId_1_attempt_1' }
    ),
    presentationEvaluationsCollection().createIndex(
      { presenterUserId: 1, attempt: 1 },
      { name: 'presenterUserId_1_attempt_1_nonunique' }
    )
  ]);

  await presentationSlotsCollection().updateMany(
    {},
    { $unset: { location: '', notes: '' } }
  );
}

async function seedUsersFromLegacyStore() {
  const users = usersCollection();
  const count = await users.countDocuments();

  if (count > 0) {
    return;
  }

  const store = await readStore();
  const legacyAdmin = store.admin || {};
  const username = String(
    legacyAdmin.username || process.env.DEFAULT_ADMIN_USERNAME || 'admin'
  ).trim();
  const passwordHash = legacyAdmin.passwordHash || '';

  if (!passwordHash) {
    throw new Error('Missing admin password hash. Set DEFAULT_ADMIN_PASSWORD and start from a clean store.');
  }

  await users.insertOne({
    username,
    passwordHash,
    role: 'admin',
    displayName: 'Central Admin',
    active: true,
    createdAt: now(),
    updatedAt: now()
  });
}

async function seedBirthdaysFromLegacyStore() {
  const birthdays = birthdaysCollection();
  const count = await birthdays.countDocuments();

  if (count > 0) {
    return;
  }

  const store = await readStore();
  const legacyMembers = Array.isArray(store.members) ? store.members : [];

  if (!legacyMembers.length) {
    return;
  }

  const docs = legacyMembers.map((member) => ({
    userId: null,
    name: String(member.name || '').trim(),
    normalizedName: normalizeName(member.name),
    birthdate: member.birthdate,
    active: member.active !== false,
    createdBy: 'legacy-import',
    createdAt: now(),
    updatedAt: now()
  }));

  try {
    await birthdays.insertMany(docs, { ordered: false });
  } catch (error) {
    if (!error?.writeErrors) {
      throw error;
    }
  }
}

async function connectToDatabase() {
  if (database) {
    return database;
  }

  client = new MongoClient(MONGO_URI);
  await client.connect();
  database = client.db(DATABASE_NAME);

  await ensureCollections();
  await ensureIndexes();
  await seedUsersFromLegacyStore();
  await seedBirthdaysFromLegacyStore();

  return database;
}

function toObjectId(value) {
  if (!ObjectId.isValid(value)) {
    return null;
  }

  return new ObjectId(value);
}

module.exports = {
  bloodDonorsCollection,
  birthdaysCollection,
  connectToDatabase,
  DATABASE_NAME,
  donationLocationsCollection,
  getDb,
  normalizeName,
  now,
  presentationBookingsCollection,
  presentationCriteriaCollection,
  presentationEvaluationsCollection,
  presentationSlotsCollection,
  presentationTopicsCollection,
  toObjectId,
  usersCollection
};
