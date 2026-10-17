const { MongoClient, ObjectId } = require('mongodb');
const dns = require('node:dns').promises;
const { readStore } = require('./store');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;
const DATABASE_NAME = process.env.MONGO_DB_NAME || 'Central_Website';

let client;
let database;

function within(promise, milliseconds, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timeout));
}

async function dnsOverHttps(name, type) {
  const response = await within(fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, {
    headers: { accept: 'application/dns-json' }
  }), 5000, `DNS-over-HTTPS ${type} lookup timed out`);
  if (!response.ok) throw new Error(`DNS-over-HTTPS ${type} lookup failed with status ${response.status}`);
  const payload = await response.json();
  if (payload.Status !== 0) throw new Error(`DNS-over-HTTPS ${type} lookup failed with status ${payload.Status}`);
  return payload.Answer || [];
}

async function resolveSrvRecords(hostname) {
  try {
    return await within(dns.resolveSrv(`_mongodb._tcp.${hostname}`), 3000, 'MongoDB SRV lookup timed out');
  } catch {
    const answers = await dnsOverHttps(`_mongodb._tcp.${hostname}`, 'SRV');
    return answers.map(({ data }) => {
      const [, , port, name] = String(data || '').trim().split(/\s+/);
      return { name: String(name || '').replace(/\.$/, ''), port: Number(port) };
    }).filter((entry) => entry.name && Number.isFinite(entry.port));
  }
}

async function resolveTxtOptions(hostname) {
  try {
    const records = await within(dns.resolveTxt(hostname), 3000, 'MongoDB TXT lookup timed out');
    return records.map((segments) => segments.join('')).join('&');
  } catch {
    const answers = await dnsOverHttps(hostname, 'TXT');
    return answers.map(({ data }) => String(data || '').replace(/^"|"$/g, '').replace(/"\s+"/g, '')).join('&');
  }
}

async function resolveMongoConnectionString(uri) {
  if (!String(uri).startsWith('mongodb+srv://')) return uri;
  const parsed = new URL(uri);
  const [records, txtOptions] = await Promise.all([
    resolveSrvRecords(parsed.hostname),
    resolveTxtOptions(parsed.hostname)
  ]);
  if (!records.length) throw new Error(`No MongoDB hosts were found for ${parsed.hostname}`);

  const options = new URLSearchParams(parsed.searchParams);
  for (const [key, value] of new URLSearchParams(txtOptions)) {
    if (!options.has(key)) options.set(key, value);
  }
  options.set('tls', 'true');
  if (!options.has('retryWrites')) options.set('retryWrites', 'true');
  if (!options.has('w')) options.set('w', 'majority');

  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : '';
  const hosts = records.map(({ name, port }) => `${name}:${port}`).join(',');
  return `mongodb://${credentials}${hosts}${parsed.pathname || '/'}?${options.toString()}`;
}

const REQUIRED_COLLECTIONS = [
  'users',
  'birthdays',
  'logistics_items',
  'logistics_activities',
  'logistics_movements',
  'app_settings',
  'blood_donors',
  'donation_locations',
  'recruitment_interest_leads',
  'quete_shifts',
  'quete_reservations',
  'presentation_topics',
  'presentation_slots',
  'presentation_bookings',
  'presentation_criteria',
  'presentation_evaluations',
  'exam_results',
  'presentation_challenges',
  'center_commitments'
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

function logisticsItemsCollection() {
  return getDb().collection('logistics_items');
}

function logisticsActivitiesCollection() {
  return getDb().collection('logistics_activities');
}

function logisticsMovementsCollection() {
  return getDb().collection('logistics_movements');
}

function bloodDonorsCollection() {
  return getDb().collection('blood_donors');
}

function appSettingsCollection() {
  return getDb().collection('app_settings');
}

function donationLocationsCollection() {
  return getDb().collection('donation_locations');
}

function recruitmentInterestLeadsCollection() {
  return getDb().collection('recruitment_interest_leads');
}

function queteShiftsCollection() {
  return getDb().collection('quete_shifts');
}

function queteReservationsCollection() {
  return getDb().collection('quete_reservations');
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

function examResultsCollection() {
  return getDb().collection('exam_results');
}

function presentationChallengesCollection() { return getDb().collection('presentation_challenges'); }
function centerCommitmentsCollection() { return getDb().collection('center_commitments'); }

async function withTransaction(action) {
  const session = client.startSession();
  try { return await session.withTransaction(() => action(session)); }
  finally { await session.endSession(); }
}

async function closeDatabase() { await client?.close(); database = undefined; client = undefined; }

// Additive, repeatable migration. Existing assignments and criteria are retained.
async function migrateAssessments() {
  await appSettingsCollection().updateOne({ _id: 'presentation-catalog-lock' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  const legacyId = new ObjectId('000000000000000000000001');
  const legacy = { title: 'Legacy presentations', description: 'Previously created presentation topics.', instructions: 'Follow the instructions supplied with your assigned topic.', active: true };
  if (await presentationTopicsCollection().countDocuments({ challengeId: { $exists: false } })) {
    await presentationChallengesCollection().updateOne({ _id: legacyId }, { $setOnInsert: { ...legacy, normalizedTitle: normalizeName(legacy.title), createdAt: now() } }, { upsert: true });
    await presentationTopicsCollection().updateMany({ challengeId: { $exists: false }, isAssigned: true }, { $set: { challengeId: legacyId, challengeSnapshot: { ...legacy, id: String(legacyId) } } });
    await presentationTopicsCollection().updateMany({ challengeId: { $exists: false } }, { $set: { challengeId: legacyId } });
  }
  // Exam grades are published when saved; only the combined final result is gated.
  const evaluators = await usersCollection().find({}).project({ role: 1 }).toArray();
  for (const user of evaluators) {
    await presentationEvaluationsCollection().updateMany({ evaluatorUserId: user._id, evaluatorRole: { $exists: false } }, { $set: { evaluatorRole: user.role === 'admin' ? 'admin' : 'member' } });
  }
  await presentationChallengesCollection().createIndex({ normalizedTitle: 1 }, { unique: true });
  await centerCommitmentsCollection().createIndex({ recruitUserId: 1 }, { unique: true });
  await presentationTopicsCollection().createIndex({ challengeId: 1 });
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
  await bloodDonorsCollection().updateMany(
    { active: { $exists: false } },
    { $set: { active: true } }
  );

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

  const logisticsIndexes = await logisticsItemsCollection().indexes();
  const legacyNameIndex = logisticsIndexes.find(
    (index) => index.unique === true && index.key?.normalizedName === 1 && !index.key?.scope
  );
  if (legacyNameIndex) await logisticsItemsCollection().dropIndex(legacyNameIndex.name);

  await logisticsItemsCollection().updateMany(
    { scope: { $exists: false } },
    {
      $set: {
        scope: 'center',
        itemType: 'reusable',
        borrowedQuantity: 0,
        consumedQuantity: 0,
        lostQuantity: 0,
        damagedQuantity: 0
      }
    }
  );

  await Promise.all([
    usersCollection().createIndex({ username: 1 }, { unique: true }),
    birthdaysCollection().createIndex({ normalizedName: 1, birthdate: 1 }, { unique: true }),
    birthdaysCollection().createIndex({ userId: 1 }),
    logisticsItemsCollection().createIndex({ scope: 1, normalizedName: 1 }, { unique: true }),
    logisticsItemsCollection().createIndex({ category: 1, name: 1 }),
    logisticsItemsCollection().createIndex({ active: 1, quantity: 1, reorderPoint: 1 }),
    logisticsActivitiesCollection().createIndex({ scope: 1, startDate: -1 }),
    logisticsActivitiesCollection().createIndex({ scope: 1, normalizedName: 1, startDate: 1 }, { unique: true }),
    logisticsMovementsCollection().createIndex({ scope: 1, createdAt: -1 }),
    logisticsMovementsCollection().createIndex({ itemId: 1, activityId: 1, activityDate: 1, createdAt: 1 }),
    logisticsMovementsCollection().createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    bloodDonorsCollection().createIndex({ userId: 1 }),
    bloodDonorsCollection().createIndex({ normalizedFullName: 1 }),
    bloodDonorsCollection().createIndex({ normalizedPhoneNumber: 1 }),
    bloodDonorsCollection().createIndex({ sourceOfContact: 1 }),
    bloodDonorsCollection().createIndex({ active: 1, nextEligibleDonationDate: 1 }),
    bloodDonorsCollection().createIndex({ location: 1 }),
    bloodDonorsCollection().createIndex({ nextEligibleDonationDate: 1 }),
    donationLocationsCollection().createIndex({ normalizedName: 1 }, { unique: true }),
    donationLocationsCollection().createIndex({ active: 1, name: 1 }),
    recruitmentInterestLeadsCollection().createIndex({ normalizedPhoneNumber: 1 }),
    recruitmentInterestLeadsCollection().createIndex({ normalizedFullName: 1, dateOfBirth: 1 }),
    recruitmentInterestLeadsCollection().createIndex({ callStatus: 1, createdAt: -1 }),
    queteShiftsCollection().createIndex({ startAt: 1 }),
    queteShiftsCollection().createIndex({ dateKey: 1, shiftType: 1, startAt: 1 }, { unique: true }),
    queteShiftsCollection().createIndex({ isActive: 1, startAt: 1 }),
    queteReservationsCollection().createIndex({ shiftId: 1, userId: 1 }, { unique: true }),
    queteReservationsCollection().createIndex({ shiftId: 1, createdAt: 1 }),
    queteReservationsCollection().createIndex({ userId: 1, createdAt: -1 }),
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
    ),
    examResultsCollection().createIndex({ recruitUserId: 1, createdAt: -1 }),
    examResultsCollection().createIndex({ createdAt: -1 })
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

  if (!MONGO_URI) {
    throw new Error('MongoDB is not configured. Set MONGO_URI in backend/.env or in the server environment.');
  }

  const connectionString = await resolveMongoConnectionString(MONGO_URI);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 10000 });
      await client.connect();
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await client?.close().catch(() => {});
      client = undefined;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  if (lastError) throw lastError;
  database = client.db(DATABASE_NAME);

  await ensureCollections();
  await ensureIndexes();
  await seedUsersFromLegacyStore();
  await seedBirthdaysFromLegacyStore();
  await migrateAssessments();

  return database;
}

function toObjectId(value) {
  if (!ObjectId.isValid(value)) {
    return null;
  }

  return new ObjectId(value);
}

module.exports = {
  closeDatabase,
  withTransaction,
  presentationChallengesCollection,
  centerCommitmentsCollection,
  bloodDonorsCollection,
  birthdaysCollection,
  appSettingsCollection,
  connectToDatabase,
  DATABASE_NAME,
  donationLocationsCollection,
  examResultsCollection,
  getDb,
  logisticsItemsCollection,
  logisticsActivitiesCollection,
  logisticsMovementsCollection,
  normalizeName,
  now,
  queteReservationsCollection,
  queteShiftsCollection,
  recruitmentInterestLeadsCollection,
  presentationBookingsCollection,
  presentationCriteriaCollection,
  presentationEvaluationsCollection,
  presentationSlotsCollection,
  presentationTopicsCollection,
  toObjectId,
  usersCollection
};
