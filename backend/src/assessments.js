const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { ObjectId } = require('mongodb');
const { requireRole } = require('./auth');
const { presentationChallengesCollection: challenges, presentationTopicsCollection: topics, presentationEvaluationsCollection: evaluations, usersCollection: users, examResultsCollection: exams, centerCommitmentsCollection: commitments, appSettingsCollection: settings, presentationBookingsCollection: bookings, presentationSlotsCollection: slots, normalizeName, now, toObjectId, withTransaction } = require('./db');
const { weightedPresentation, finalAssessment, round } = require('./assessment-scoring');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const id = (value) => { const result = typeof value === 'string' ? toObjectId(value) : null; if (!result) fail('Invalid record ID.'); return result; };
const text = (value, max = 10000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const challengePayload = (body) => {
  const title = text(body.title, 160), description = text(body.description), instructions = text(body.instructions, 20000);
  if (!title || !description || !instructions) fail('Challenge title, description and instructions are required.');
  return { title, normalizedTitle: normalizeName(title), description, instructions, active: body.active !== false };
};
const publicChallenge = (doc) => doc ? { id: String(doc._id), title: doc.title, description: doc.description, instructions: doc.instructions, active: doc.active !== false } : null;
async function readWeights() {
  const doc = await settings().findOne({ _id: 'assessment-weights' });
  return { admin: doc?.admin ?? 2, member: doc?.member ?? 1 };
}
async function catalogLock(session) {
  await settings().updateOne({ _id: 'presentation-catalog-lock' }, { $inc: { revision: 1 } }, { upsert: true, session });
}
async function assignedTopicFor(userId) {
  const topic = await topics().findOne({ assignedTo: userId });
  if (!topic) return null;
  return { ...topic, challenge: topic.challengeSnapshot || publicChallenge(await challenges().findOne({ _id: topic.challengeId })) };
}

async function assignChallenge(userId) {
  return withTransaction(async (session) => {
    await catalogLock(session);
    const existing = await topics().findOne({ assignedTo: userId }, { session });
    if (existing) return existing;
    const active = await challenges().find({ active: { $ne: false } }, { session }).toArray();
    const candidates = await topics().find({ challengeId: { $in: active.map((item) => item._id) }, isAssigned: false, active: { $ne: false } }, { session }).toArray();
    if (!candidates.length) fail('No active challenge topics are available.', 409);
    const topic = candidates[Math.floor(Math.random() * candidates.length)];
    const challenge = active.find((item) => String(item._id) === String(topic.challengeId));
    const update = { assignedTo: userId, assignedAt: now(), isAssigned: true, challengeSnapshot: publicChallenge(challenge) };
    await topics().updateOne({ _id: topic._id, isAssigned: false }, { $set: update }, { session });
    return { ...topic, ...update };
  });
}

const columns = ['Challenge title', 'Challenge description', 'Challenge instructions', 'Topic title', 'Topic description'];
async function validateImport(rows, session) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) fail('Provide between 1 and 500 topic rows.');
  const existingChallenges = await challenges().find({}, { session }).toArray();
  const existingTopics = await topics().find({}, { session }).toArray();
  const groups = new Map(), seen = new Set(), errors = [];
  const normalized = rows.map((row, index) => {
    const result = { challengeTitle: text(row.challengeTitle, 160), description: text(row.description), instructions: text(row.instructions, 20000), title: text(row.title, 160), topicDescription: text(row.topicDescription) };
    const key = normalizeName(result.challengeTitle), topicKey = `${key}:${normalizeName(result.title)}`;
    const existing = existingChallenges.find((item) => item.normalizedTitle === key);
    if (!result.challengeTitle || !result.description || !result.instructions || !result.title) errors.push(`Row ${index + 2}: challenge title, description, instructions and topic title are required.`);
    const group = groups.get(key);
    if ((group && (group.description !== result.description || group.instructions !== result.instructions)) || (existing && (existing.description !== result.description || existing.instructions !== result.instructions))) errors.push(`Row ${index + 2}: conflicting instructions or description for this challenge.`);
    if (seen.has(topicKey) || existingTopics.some((topic) => String(topic.challengeId) === String(existing?._id) && normalizeName(topic.title) === normalizeName(result.title))) errors.push(`Row ${index + 2}: duplicate topic in this challenge.`);
    groups.set(key, result); seen.add(topicKey);
    return result;
  });
  return { rows: normalized, errors, challengeCount: groups.size, topicCount: rows.length };
}

async function assessmentReport(recruitId) {
  const [people, allTopics, allExams, allEvaluations, allCommitments, allBookings, allSlots, weights, allUsers] = await Promise.all([
    users().find({ role: 'new recruit', ...(recruitId ? { _id: id(recruitId) } : {}) }).sort({ displayName: 1 }).toArray(), topics().find({ isAssigned: true }).toArray(), exams().find({}).sort({ createdAt: -1 }).toArray(), evaluations().find({}).toArray(), commitments().find({}).toArray(), bookings().find({}).toArray(), slots().find({}).toArray(), readWeights(), users().find({}).toArray()
  ]);
  const rows = people.map((person) => {
    const key = String(person._id), topic = allTopics.find((item) => String(item.assignedTo) === key);
    const exam = allExams.find((item) => String(item.recruitUserId) === key);
    const commitment = allCommitments.find((item) => String(item.recruitUserId) === key);
    const ownEvaluations = allEvaluations.filter((item) => String(item.presenterUserId) === key).map((item) => ({ ...item, evaluatorRole: item.evaluatorRole || allUsers.find((user) => String(user._id) === String(item.evaluatorUserId))?.role || 'member' }));
    const attempts = [1, 2].map((attempt) => weightedPresentation(ownEvaluations.filter((item) => Number(item.attempt || 1) === attempt), weights));
    const selectedAttempt = person.allowPresentationAttemptTwo && attempts[1].score !== null ? 2 : 1;
    const presentation = attempts[selectedAttempt - 1];
    const booking = allBookings.find((item) => String(item.userId) === key);
    const slot = booking && allSlots.find((item) => String(item._id) === String(booking.slotId));
    return {
      id: key, name: person.displayName || person.username, username: person.username,
      challenge: topic ? topic.challengeSnapshot?.title || 'Legacy presentations' : 'Unassigned', topic: topic?.title || null,
      reservation: slot ? { startAt: slot.startAt, endAt: slot.endAt } : null,
      presentationVisible: person.presentationResultVisible === true,
      finalVisible: person.finalResultVisible === true, examId: exam ? String(exam._id) : null,
      commitmentHistory: commitment?.history || [],
      selectedAttempt, evaluatorCount: presentation.entries.length,
      evaluators: attempts.flatMap((attempt, index) => attempt.entries.map(({ evaluation, score, weight }) => ({
        attempt: index + 1, included: index + 1 === selectedAttempt,
        name: allUsers.find((user) => String(user._id) === String(evaluation.evaluatorUserId))?.displayName || 'Historical evaluator',
        role: evaluation.evaluatorRole, score: round(score), weight, weightedScore: round(score * weight)
      }))),
      ...finalAssessment(exam, presentation.score, commitment?.score)
    };
  });
  return { weights, rows, generatedAt: now() };
}

function workbookResponse(res, sheets, filename) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}

function assessmentRouter() {
  const router = express.Router();
  router.get('/me', requireRole('new recruit'), wrap(async (req, res) => {
    const { rows } = await assessmentReport(String(req.account._id));
    const row = rows[0];
    if (!row) fail('Recruit not found.', 404);
    // Hidden presentation grades must also stay out of the final-score breakdown.
    const components = { ...row.components };
    const contributions = { ...row.contributions };
    if (!row.presentationVisible) {
      delete components.presentation;
      delete contributions.presentation;
    }
    res.json({ presentationVisible: row.presentationVisible,
      ...(row.presentationVisible ? { presentation: row.components.presentation, selectedAttempt: row.selectedAttempt } : {}),
      finalVisible: row.finalVisible,
      ...(row.finalVisible ? { total: row.total, status: row.status, missing: row.missing, components, contributions } : {}) });
  }));
  router.use(requireRole('admin'));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  router.get('/challenges', wrap(async (req, res) => {
    const [list, topicList, people] = await Promise.all([challenges().find({}).sort({ title: 1 }).toArray(), topics().find({}).toArray(), users().find({}).project({ displayName: 1, username: 1 }).toArray()]);
    res.json(list.map((item) => ({ ...publicChallenge(item), topics: topicList.filter((topic) => String(topic.challengeId) === String(item._id)).map((topic) => ({ id: String(topic._id), title: topic.title, description: topic.description, active: topic.active !== false, isAssigned: topic.isAssigned, assignedToName: people.find((user) => String(user._id) === String(topic.assignedTo))?.displayName || '' })) })));
  }));
  router.post('/challenges', wrap(async (req, res) => {
    const payload = challengePayload(req.body || {});
    const result = await challenges().insertOne({ ...payload, createdAt: now() });
    res.status(201).json({ id: String(result.insertedId) });
  }));
  router.put('/challenges/:id', wrap(async (req, res) => {
    const payload = challengePayload(req.body || {}), challengeId = id(req.params.id);
    await withTransaction(async (session) => {
      await catalogLock(session);
      // Assigned records retain the immutable instruction snapshot captured on spin.
      const result = await challenges().updateOne({ _id: challengeId }, { $set: { ...payload, updatedAt: now() } }, { session });
      if (!result.matchedCount) fail('Challenge not found.', 404);
    });
    res.json({ ok: true });
  }));
  router.delete('/challenges/:id', wrap(async (req, res) => {
    await withTransaction(async (session) => {
      await catalogLock(session);
      const challengeId = id(req.params.id);
      if (await topics().countDocuments({ challengeId }, { session })) fail('Remove unassigned topics first. Challenges with assigned topics cannot be deleted.', 409);
      const result = await challenges().deleteOne({ _id: challengeId }, { session });
      if (!result.deletedCount) fail('Challenge not found.', 404);
    });
    res.status(204).end();
  }));
  router.post('/challenges/:id/topics', wrap(async (req, res) => {
    await withTransaction(async (session) => {
      await catalogLock(session);
      const challengeId = id(req.params.id), title = text(req.body.title, 160);
      if (!title) fail('Topic title is required.');
      if (!await challenges().findOne({ _id: challengeId }, { session })) fail('Challenge not found.', 404);
      const siblings = await topics().find({ challengeId }, { session }).toArray();
      if (siblings.some((topic) => normalizeName(topic.title) === normalizeName(title))) fail('This challenge already contains that topic.', 409);
      await topics().insertOne({ challengeId, title, description: text(req.body.description), active: req.body.active !== false, isAssigned: false, assignedTo: null, createdAt: now() }, { session });
    });
    res.status(201).json({ ok: true });
  }));
  router.put('/topics/:id', wrap(async (req, res) => {
    await withTransaction(async (session) => {
      await catalogLock(session);
      const topicId = id(req.params.id), topic = await topics().findOne({ _id: topicId }, { session });
      if (!topic) fail('Topic not found.', 404);
      if (topic.isAssigned) fail('Assigned topics are locked to preserve evaluation history.', 409);
      const title = text(req.body.title, 160);
      if (!title) fail('Topic title is required.');
      const siblings = await topics().find({ challengeId: topic.challengeId, _id: { $ne: topicId } }, { session }).toArray();
      if (siblings.some((item) => normalizeName(item.title) === normalizeName(title))) fail('Duplicate topic title.', 409);
      await topics().updateOne({ _id: topicId }, { $set: { title, description: text(req.body.description), active: req.body.active !== false } }, { session });
    });
    res.json({ ok: true });
  }));
  router.delete('/topics/:id', wrap(async (req, res) => {
    await withTransaction(async (session) => {
      await catalogLock(session);
      const result = await topics().deleteOne({ _id: id(req.params.id), isAssigned: false }, { session });
      if (!result.deletedCount) fail('Topic is assigned or no longer exists.', 409);
    });
    res.status(204).end();
  }));
  router.get('/challenges-template', (req, res) => workbookResponse(res, { Challenges: [Object.fromEntries(columns.map((column) => [column, '']))] }, 'challenge-template.xlsx'));
  router.post('/import/preview', upload.single('excel'), wrap(async (req, res) => {
    if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) fail('Upload an .xlsx workbook.');
    let book;
    try { book = XLSX.read(req.file.buffer, { type: 'buffer', sheetRows: 502 }); } catch { fail('The Excel workbook could not be read.'); }
    const sheet = book.Sheets[book.SheetNames[0]];
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
    if (columns.some((column) => !headers.includes(column))) fail('Use the downloaded template with all five column headers.');
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((row) => ({ challengeTitle: row[columns[0]], description: row[columns[1]], instructions: row[columns[2]], title: row[columns[3]], topicDescription: row[columns[4]] }));
    res.json(await validateImport(rows));
  }));
  router.post('/import/confirm', wrap(async (req, res) => {
    const result = await withTransaction(async (session) => {
      await catalogLock(session);
      const preview = await validateImport(req.body.rows, session);
      if (preview.errors.length) fail(preview.errors.join('\n'));
      const ids = new Map();
      for (const row of preview.rows) {
        const normalizedTitle = normalizeName(row.challengeTitle);
        if (!ids.has(normalizedTitle)) {
          let challenge = await challenges().findOne({ normalizedTitle }, { session });
          if (!challenge) {
            challenge = { _id: new ObjectId(), title: row.challengeTitle, normalizedTitle, description: row.description, instructions: row.instructions, active: true, createdAt: now() };
            await challenges().insertOne(challenge, { session });
          }
          ids.set(normalizedTitle, challenge._id);
        }
        await topics().insertOne({ challengeId: ids.get(normalizedTitle), title: row.title, description: row.topicDescription, active: true, isAssigned: false, assignedTo: null, createdAt: now() }, { session });
      }
      return { imported: preview.topicCount };
    });
    res.status(201).json(result);
  }));
  router.get('/weights', wrap(async (req, res) => res.json(await readWeights())));
  router.put('/weights', wrap(async (req, res) => {
    const admin = Number(req.body.admin), member = Number(req.body.member);
    if (!Number.isFinite(admin) || !Number.isFinite(member) || member <= 0 || admin <= member || admin > 100 || member > 100) fail('Weights must be positive, at most 100, with Admin greater than GA.');
    await settings().updateOne({ _id: 'assessment-weights' }, { $set: { admin, member, updatedAt: now() }, $push: { history: { admin, member, at: now(), by: req.account.username } } }, { upsert: true });
    res.json({ admin, member });
  }));
  router.put('/commitments/:id', wrap(async (req, res) => {
    const recruitUserId = id(req.params.id), score = req.body.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) fail('Commitment must be a number from 0 to 100.');
    if (!await users().findOne({ _id: recruitUserId, role: 'new recruit' })) fail('Recruit not found.', 404);
    await commitments().updateOne({ recruitUserId }, { $set: { score, updatedAt: now() }, $setOnInsert: { createdAt: now() }, $push: { history: { score, at: now(), by: req.account.username } } }, { upsert: true });
    res.json({ ok: true });
  }));
  router.patch('/recruits/:id/presentation-visibility', wrap(async (req, res) => {
    if (typeof req.body.visible !== 'boolean') fail('Visibility must be true or false.');
    const recruitId = id(req.params.id);
    if (req.body.visible) {
      const { rows } = await assessmentReport(req.params.id);
      if (!rows.length) fail('Recruit not found.', 404);
      if (rows[0].components.presentation === null) fail('Grade the presentation before publishing its result.', 409);
    }
    const result = await users().updateOne({ _id: recruitId, role: 'new recruit' }, {
      $set: { presentationResultVisible: req.body.visible, updatedAt: now() },
      $push: { presentationVisibilityHistory: { visible: req.body.visible, by: req.account.username, at: now() } }
    });
    if (!result.matchedCount) fail('Recruit not found.', 404);
    res.json({ ok: true });
  }));
  router.patch('/recruits/:id/final-visibility', wrap(async (req, res) => {
    if (typeof req.body.visible !== 'boolean') fail('Visibility must be true or false.');
    if (req.body.visible) {
      const report = await assessmentReport(req.params.id);
      const recruit = report.rows[0];
      if (!recruit) fail('Recruit not found.', 404);
      if (recruit.total === null) fail(`Complete all components before publishing. Missing: ${recruit.missing.join(', ')}.`, 409);
    }
    const result = await users().updateOne({ _id: id(req.params.id), role: 'new recruit' }, { $set: { finalResultVisible: req.body.visible, updatedAt: now() }, $push: { finalVisibilityHistory: { visible: req.body.visible, by: req.account.username, at: now() } } });
    if (!result.matchedCount) fail('Recruit not found.', 404);
    res.json({ ok: true });
  }));
  router.get('/report', wrap(async (req, res) => res.json(await assessmentReport(req.query.recruitId))));
  router.get('/report/export', wrap(async (req, res) => {
    const report = await assessmentReport(req.query.recruitId);
    workbookResponse(res, {
      Results: report.rows.map((row) => ({ Recruit: row.name, Username: row.username, Challenge: row.challenge, Topic: row.topic || 'Unassigned', Reservation: row.reservation?.startAt || 'Not booked', 'Exam /100': row.components.exam ?? 'Missing', 'Presentation /100': row.components.presentation ?? 'Missing', 'Commitment /100': row.components.commitment ?? 'Missing', 'Exam ×40%': row.contributions.exam ?? 'Missing', 'Presentation ×40%': row.contributions.presentation ?? 'Missing', 'Commitment ×20%': row.contributions.commitment ?? 'Missing', 'Final /100': row.total ?? 'Incomplete', Status: row.status, 'Selected attempt': row.selectedAttempt, Evaluators: row.evaluatorCount, 'Presentation visible': row.presentationVisible ? 'Yes' : 'No', 'Final score visible': row.finalVisible ? 'Yes' : 'No' })),
      Evaluators: report.rows.flatMap((row) => row.evaluators.map((item) => ({ Recruit: row.name, Evaluator: item.name, Role: item.role, Attempt: item.attempt, 'Used in final': item.included ? 'Yes' : 'No', 'Score /100': item.score, Weight: item.weight, 'Score × weight': item.weightedScore }))),
      Method: [{ 'Exam weight': '40%', 'Presentation weight': '40%', 'Commitment weight': '20%', 'Admin evaluator weight': report.weights.admin, 'GA evaluator weight': report.weights.member, Formula: 'Presentation = sum(score × weight) / sum(weight). Final requires all three components. Enabled scored attempt 2 replaces attempt 1.' }]
    }, 'recruit-assessments.xlsx');
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.code === 11000 ? 409 : error.status || (error instanceof multer.MulterError ? 400 : 500)).json({ error: error.code === 11000 ? 'A record with that name already exists.' : error.status ? error.message : 'Unable to complete the assessment request. Please retry.' });
  });
  return router;
}

module.exports = { assessmentRouter, readWeights, assignChallenge, assignedTopicFor, publicChallenge, assessmentReport, validateImport };
