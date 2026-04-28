const { connectToDatabase, getDb } = require('./db');

const REQUIRED_COLLECTIONS = [
  'users',
  'birthdays',
  'blood_donors',
  'presentation_topics',
  'presentation_slots',
  'presentation_bookings',
  'presentation_criteria',
  'presentation_evaluations'
];

async function ensureCollections() {
  await connectToDatabase();
  const db = getDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const created = [];

  for (const name of REQUIRED_COLLECTIONS) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      created.push(name);
    }
  }

  const finalNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name)
    .filter((name) => REQUIRED_COLLECTIONS.includes(name))
    .sort();

  console.log(JSON.stringify({ created, collections: finalNames }, null, 2));
}

ensureCollections().catch((error) => {
  console.error('Failed to initialize Mongo collections:', error);
  process.exit(1);
});
