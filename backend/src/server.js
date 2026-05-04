const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const { authMiddleware, requireRole, signAuthToken } = require('./auth');
const {
  bloodDonorsCollection,
  birthdaysCollection,
  connectToDatabase,
  DATABASE_NAME,
  donationLocationsCollection,
  normalizeName,
  now,
  presentationBookingsCollection,
  presentationCriteriaCollection,
  presentationEvaluationsCollection,
  presentationSlotsCollection,
  presentationTopicsCollection,
  recruitmentInterestLeadsCollection,
  toObjectId,
  usersCollection
} = require('./db');
const { startBirthdayScheduler, runBirthdayCheck } = require('./scheduler');
const { dataFile, readTelegramSettings, writeTelegramSettings } = require('./store');

const PORT = Number(process.env.PORT || 4000);
const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://lrcy-jbeil.online',
  'https://www.lrcy-jbeil.online',
  'https://youth.lrcy-jbeil.online'
];

const allowedOrigins = new Set(
  String(process.env.CORS_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
app.use(express.json());

const USER_ROLES = ['admin', 'member', 'new recruit'];
const MODULE_ACCESS_KEYS = ['bloodDrive', 'recruitment', 'presentations'];

function isValidBirthdate(value) {
  return /^\d{2}-\d{2}$/.test(value);
}

function formatDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return new Date(value).toISOString();
}

function getPresentationYear(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function getCurrentPresentationYear() {
  return getPresentationYear(now());
}

function parsePresentationYear(value) {
  const currentYear = getCurrentPresentationYear();
  const numericYear = Number(value || currentYear);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > currentYear + 10) {
    return currentYear;
  }
  return numericYear;
}

function isSamePresentationYear(value, year) {
  return getPresentationYear(value) === year;
}

function addMinutes(value, minutes) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function addMonths(date, count) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

function calculateAgeFromDateOfBirth(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizePhoneNumber(value) {
  return String(value || '').replace(/\D+/g, '');
}

function buildLocationHistory(existingHistory = [], nextLocation) {
  const normalizedNext = String(nextLocation || '').trim();
  const values = Array.isArray(existingHistory) ? existingHistory : [];
  const unique = new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase())
  );

  if (normalizedNext && !unique.has(normalizedNext.toLowerCase())) {
    return [...values.filter(Boolean), normalizedNext];
  }

  return values.filter((value) => String(value || '').trim());
}

function isAdminAccount(account) {
  return account?.role === 'admin';
}

function createDefaultModuleAccess(role = 'member') {
  if (role === 'admin') {
    return {
      bloodDrive: true,
      recruitment: true,
      presentations: true
    };
  }

  if (role === 'new recruit') {
    return {
      bloodDrive: false,
      recruitment: false,
      presentations: true
    };
  }

  return {
    bloodDrive: true,
    recruitment: true,
    presentations: true
  };
}

function normalizeModuleAccess(role = 'member', moduleAccess = {}) {
  const defaults = createDefaultModuleAccess(role);
  return MODULE_ACCESS_KEYS.reduce((accumulator, key) => {
    accumulator[key] = typeof moduleAccess?.[key] === 'boolean' ? moduleAccess[key] : defaults[key];
    return accumulator;
  }, {});
}

function createSignupModuleAccess(role = 'member') {
  if (role === 'member') {
    return {
      bloodDrive: false,
      recruitment: false,
      presentations: true
    };
  }

  return createDefaultModuleAccess(role);
}

function hasModuleAccess(account, moduleKey) {
  if (isAdminAccount(account)) {
    return true;
  }

  return Boolean(normalizeModuleAccess(account?.role, account?.moduleAccess)[moduleKey]);
}

function requireModuleAccess(moduleKey) {
  return (req, res, next) => {
    if (hasModuleAccess(req.account, moduleKey)) {
      return next();
    }

    return res.status(403).json({ error: 'You do not have access to this section.' });
  };
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    active: Boolean(user.active),
    moduleAccess: normalizeModuleAccess(user.role, user.moduleAccess)
  };
}

function sanitizeBirthday(entry) {
  return {
    id: String(entry._id),
    userId: entry.userId ? String(entry.userId) : null,
    name: entry.name,
    birthdate: entry.birthdate,
    active: Boolean(entry.active),
    createdBy: entry.createdBy || null,
    updatedAt: entry.updatedAt || null
  };
}

function sanitizeBloodDonor(entry) {
  const computedAge = calculateAgeFromDateOfBirth(entry.dateOfBirth);
  const derivedCallStatus = entry.callStatus || (entry.contacted ? (entry.willingToDonate ? 'upcoming' : 'not-willing') : '');
  return {
    id: String(entry._id),
    userId: entry.userId ? String(entry.userId) : null,
    firstName: entry.firstName,
    lastName: entry.lastName,
    fullName: `${entry.firstName} ${entry.lastName}`.trim(),
    age: computedAge,
    dateOfBirth: entry.dateOfBirth,
    phoneNumber: entry.phoneNumber,
    normalizedPhoneNumber: entry.normalizedPhoneNumber || normalizePhoneNumber(entry.phoneNumber),
    location: entry.location || '',
    locationHistory: buildLocationHistory(entry.locationHistory, entry.location || ''),
    contacted: entry.contacted === true,
    willingToDonate: entry.willingToDonate === true,
    callStatus: derivedCallStatus,
    lastCallDate: entry.lastCallDate || '',
    upcomingDonationDate: entry.upcomingDonationDate || '',
    callHistory: Array.isArray(entry.callHistory)
      ? entry.callHistory.map((item) => ({
          callDate: item.callDate || '',
          callStatus: item.callStatus || '',
          upcomingDonationDate: item.upcomingDonationDate || '',
          notes: item.notes || '',
          recordedByName: item.recordedByName || ''
        }))
      : [],
    notes: entry.notes || '',
    lastDonationDate: entry.lastDonationDate || '',
    lastUpdatedDate: entry.lastUpdatedDate,
    updatedByName: entry.updatedByName,
    nextEligibleDonationDate: entry.nextEligibleDonationDate,
    isEligible: Boolean(entry.isEligible)
  };
}

function sanitizeDonationLocation(location) {
  return {
    id: String(location._id),
    name: location.name,
    active: location.active !== false,
    createdAt: location.createdAt ? formatDateTime(location.createdAt) : null,
    updatedAt: location.updatedAt ? formatDateTime(location.updatedAt) : null
  };
}

function sanitizeRecruitmentInterestLead(lead) {
  return {
    id: String(lead._id),
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
    dateOfBirth: lead.dateOfBirth || '',
    phoneNumber: lead.phoneNumber || '',
    callStatus: lead.callStatus || '',
    lastCallDate: lead.lastCallDate || '',
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || '',
    updatedByName: lead.updatedByName || '',
    createdAt: lead.createdAt ? formatDateTime(lead.createdAt) : null,
    updatedAt: lead.updatedAt ? formatDateTime(lead.updatedAt) : null,
    callHistory: Array.isArray(lead.callHistory)
      ? lead.callHistory.map((item) => ({
          callDate: item.callDate || '',
          callStatus: item.callStatus || '',
          followUpDate: item.followUpDate || '',
          notes: item.notes || '',
          recordedByName: item.recordedByName || ''
        }))
      : []
  };
}

function sanitizePresentationTopic(topic) {
  return {
    id: String(topic._id),
    title: topic.title,
    description: topic.description || '',
    isAssigned: Boolean(topic.isAssigned),
    assignedTo: topic.assignedTo ? String(topic.assignedTo) : null,
    assignedAt: topic.assignedAt ? formatDateTime(topic.assignedAt) : null,
    createdAt: topic.createdAt ? formatDateTime(topic.createdAt) : null
  };
}

function sanitizePresentationCriterion(criterion) {
  return {
    id: String(criterion._id),
    title: criterion.title,
    description: criterion.description || '',
    order: criterion.order,
    isActive: criterion.isActive !== false,
    createdAt: criterion.createdAt ? formatDateTime(criterion.createdAt) : null
  };
}

function sanitizePresentationSlot(slot, booking = null, occupant = null) {
  return {
    id: String(slot._id),
    startAt: formatDateTime(slot.startAt),
    endAt: formatDateTime(slot.endAt),
    capacity: slot.capacity || 1,
    isActive: slot.isActive !== false,
    bookingCount: slot.bookingCount || 0,
    isBooked: Boolean(booking),
    booking: booking
      ? {
          id: String(booking._id),
          userId: String(booking.userId),
          bookedAt: booking.confirmedAt ? formatDateTime(booking.confirmedAt) : null
        }
      : null,
    bookedByName: occupant ? occupant.displayName || occupant.username : null
  };
}

function sanitizePresentationEvaluation(evaluation) {
  const criteria = Array.isArray(evaluation.criteria)
    ? evaluation.criteria.map((item) => ({
        criterionId: item.criterionId ? String(item.criterionId) : null,
        title: item.title,
        order: item.order,
        score: item.score
      }))
    : [];

  return {
    id: String(evaluation._id),
    presenterUserId: String(evaluation.presenterUserId),
    evaluatorUserId: evaluation.evaluatorUserId ? String(evaluation.evaluatorUserId) : null,
    attempt: evaluation.attempt || 1,
    totalScore: criteria.length ? calculatePresentationTotalScore(criteria) : (evaluation.totalScore || 0),
    comment: evaluation.comment || '',
    updatedAt: evaluation.updatedAt ? formatDateTime(evaluation.updatedAt) : null,
    createdAt: evaluation.createdAt ? formatDateTime(evaluation.createdAt) : null,
    criteria
  };
}

function sanitizePresentationEvaluationWithEvaluator(evaluation, evaluator = null) {
  return {
    ...sanitizePresentationEvaluation(evaluation),
    evaluator: evaluator ? sanitizeUser(evaluator) : null
  };
}

function calculatePresentationTotalScore(criteriaRows) {
  if (!criteriaRows.length) return 0;
  const rawTotal = criteriaRows.reduce((sum, item) => sum + (item.score || 0), 0);
  const maxTotal = criteriaRows.length * 10;
  return Number(((rawTotal / maxTotal) * 100).toFixed(2));
}

function averageScores(evaluations) {
  if (!evaluations.length) return null;
  const total = evaluations.reduce((sum, item) => {
    const score = Array.isArray(item.criteria) && item.criteria.length
      ? calculatePresentationTotalScore(item.criteria)
      : (item.totalScore || 0);
    return sum + score;
  }, 0);
  return Number((total / evaluations.length).toFixed(2));
}

async function requireAuthenticatedUser(req, res, next) {
  const userId = toObjectId(req.user.userId);

  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = await usersCollection().findOne({ _id: userId });

  if (!user || user.active === false) {
    return res.status(401).json({ error: 'User no longer has access' });
  }

  req.account = user;
  return next();
}

async function getBirthdayById(id) {
  const birthdayId = toObjectId(id);
  if (!birthdayId) return null;
  return birthdaysCollection().findOne({ _id: birthdayId });
}

async function getBloodDonorById(id) {
  const donorId = toObjectId(id);
  if (!donorId) return null;
  return bloodDonorsCollection().findOne({ _id: donorId });
}

async function findExistingBloodDonor({ firstName, lastName, dateOfBirth, phoneNumber, excludeId = null }) {
  const normalizedFullName = normalizeName(`${firstName} ${lastName}`);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const trimmedPhone = String(phoneNumber || '').trim();
  const matchClauses = [
    { normalizedFullName, dateOfBirth: formatDateOnly(dateOfBirth) }
  ];

  if (normalizedPhone) {
    matchClauses.push({ normalizedPhoneNumber: normalizedPhone });
  }

  if (trimmedPhone) {
    matchClauses.push({ phoneNumber: trimmedPhone });
  }

  const query = {
    $or: matchClauses
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return bloodDonorsCollection().findOne(query);
}

async function findExistingRecruitmentInterestLead({ firstName, lastName, dateOfBirth, phoneNumber, excludeId = null }) {
  const normalizedFullName = normalizeName(`${firstName} ${lastName}`);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const trimmedPhone = String(phoneNumber || '').trim();
  const matchClauses = [
    { normalizedFullName, dateOfBirth: formatDateOnly(dateOfBirth) }
  ];

  if (normalizedPhone) {
    matchClauses.push({ normalizedPhoneNumber: normalizedPhone });
  }

  if (trimmedPhone) {
    matchClauses.push({ phoneNumber: trimmedPhone });
  }

  const query = { $or: matchClauses };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return recruitmentInterestLeadsCollection().findOne(query);
}

async function getPresentationTopicById(id) {
  const topicId = toObjectId(id);
  if (!topicId) return null;
  return presentationTopicsCollection().findOne({ _id: topicId });
}

async function getPresentationSlotById(id) {
  const slotId = toObjectId(id);
  if (!slotId) return null;
  return presentationSlotsCollection().findOne({ _id: slotId });
}

async function getPresentationCriterionById(id) {
  const criterionId = toObjectId(id);
  if (!criterionId) return null;
  return presentationCriteriaCollection().findOne({ _id: criterionId });
}

async function getBookedSlotIdForUser(userId) {
  const booking = await presentationBookingsCollection().findOne({ userId });
  return booking ? booking.slotId : null;
}

async function buildDashboardSummary() {
  const today = formatDateOnly(now());
  const [
    totalUsers,
    totalAdmins,
    totalMembers,
    totalNewRecruits,
    totalBirthdays,
    activeBirthdays,
    totalBloodDonors,
    eligibleBloodDonors,
    presentationTopics,
    assignedPresentationTopics,
    presentationSlots,
    bookedPresentationSlots
  ] = await Promise.all([
    usersCollection().countDocuments(),
    usersCollection().countDocuments({ role: 'admin' }),
    usersCollection().countDocuments({ role: 'member' }),
    usersCollection().countDocuments({ role: 'new recruit' }),
    birthdaysCollection().countDocuments(),
    birthdaysCollection().countDocuments({ active: true }),
    bloodDonorsCollection().countDocuments(),
    bloodDonorsCollection().countDocuments({ nextEligibleDonationDate: { $lte: today } }),
    presentationTopicsCollection().countDocuments(),
    presentationTopicsCollection().countDocuments({ isAssigned: true }),
    presentationSlotsCollection().countDocuments({ isActive: true }),
    presentationBookingsCollection().countDocuments()
  ]);

  return {
    totalUsers,
    totalAdmins,
    totalMembers,
    totalNewRecruits,
    totalBirthdays,
    activeBirthdays,
    totalBloodDonors,
    eligibleBloodDonors,
    presentationTopics,
    assignedPresentationTopics,
    presentationSlots,
    bookedPresentationSlots
  };
}

async function hydratePresentationSlots(slots, bookings, usersMap) {
  const bookingsBySlotId = new Map(bookings.map((booking) => [String(booking.slotId), booking]));
  return slots.map((slot) =>
    sanitizePresentationSlot(
      slot,
      bookingsBySlotId.get(String(slot._id)) || null,
      usersMap.get(String((bookingsBySlotId.get(String(slot._id)) || {}).userId || '')) || null
    )
  );
}

async function buildPresentationDashboard(account, options = {}) {
  const selectedYear = parsePresentationYear(options.year);
  const [topics, slots, bookings, criteria, evaluations, recruits, allUsers] = await Promise.all([
    presentationTopicsCollection().find({}).sort({ createdAt: 1 }).toArray(),
    presentationSlotsCollection().find({}).sort({ startAt: 1 }).toArray(),
    presentationBookingsCollection().find({}).toArray(),
    presentationCriteriaCollection().find({}).sort({ order: 1, createdAt: 1 }).toArray(),
    presentationEvaluationsCollection().find({}).toArray(),
    usersCollection()
      .find({ role: 'new recruit' })
      .sort({ displayName: 1, username: 1 })
      .toArray(),
    usersCollection().find({}).toArray()
  ]);

  const recruitIds = recruits.map((user) => user._id);
  const availableYears = Array.from(new Set([
    getCurrentPresentationYear(),
    ...topics.flatMap((topic) => [topic.createdAt, topic.assignedAt]).map(getPresentationYear).filter(Boolean),
    ...slots.map((slot) => getPresentationYear(slot.startAt)).filter(Boolean),
    ...evaluations.flatMap((evaluation) => [evaluation.createdAt, evaluation.updatedAt]).map(getPresentationYear).filter(Boolean)
  ])).sort((a, b) => b - a);
  const topicsForYear = topics.filter((topic) =>
    isSamePresentationYear(topic.assignedAt || topic.createdAt, selectedYear)
  );
  const slotsForYear = slots.filter((slot) => isSamePresentationYear(slot.startAt, selectedYear));
  const slotIdsForYear = new Set(slotsForYear.map((slot) => String(slot._id)));
  const bookingsForYear = bookings.filter((booking) => slotIdsForYear.has(String(booking.slotId)));
  const topicIdsForYear = new Set(topicsForYear.filter((topic) => topic.assignedTo).map((topic) => String(topic.assignedTo)));
  const topicByAssignedTo = new Map(
    topicsForYear.filter((topic) => topic.assignedTo).map((topic) => [String(topic.assignedTo), topic])
  );
  const bookingByUserId = new Map(bookingsForYear.map((booking) => [String(booking.userId), booking]));
  const slotById = new Map(slotsForYear.map((slot) => [String(slot._id), slot]));
  const evaluationsByPresenterId = new Map();
  for (const evaluation of evaluations) {
    const presenterKey = String(evaluation.presenterUserId);
    const hasTopicInYear = topicIdsForYear.has(presenterKey);
    const bookingForPresenter = bookingsForYear.find((booking) => String(booking.userId) === presenterKey);
    const hasEvaluationYear = isSamePresentationYear(evaluation.updatedAt || evaluation.createdAt, selectedYear);
    if (!hasTopicInYear && !bookingForPresenter && !hasEvaluationYear) {
      continue;
    }
    const key = String(evaluation.presenterUserId);
    const group = evaluationsByPresenterId.get(key) || [];
    group.push(evaluation);
    evaluationsByPresenterId.set(key, group);
  }
  const usersMap = new Map(recruits.map((user) => [String(user._id), user]));
  const allUsersMap = new Map(allUsers.map((user) => [String(user._id), user]));
  const isAdminViewer = isAdminAccount(account);
  const currentUserId = account?._id ? String(account._id) : null;

  const presenters = recruits
    .map((user) => {
      const topic = topicByAssignedTo.get(String(user._id)) || null;
      const booking = bookingByUserId.get(String(user._id)) || null;
      const slot = booking ? slotById.get(String(booking.slotId)) || null : null;
      const evaluationAttempts = (evaluationsByPresenterId.get(String(user._id)) || [])
        .slice()
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));
      const latestEvaluation = evaluationAttempts
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
      const attempt1Evaluations = evaluationAttempts.filter((item) => (item.attempt || 1) === 1);
      const attempt2Evaluations = evaluationAttempts.filter((item) => (item.attempt || 1) === 2);
      const myEvaluationAttempts = currentUserId
        ? evaluationAttempts.filter((item) => String(item.evaluatorUserId || '') === currentUserId)
        : [];

      return {
        user: sanitizeUser(user),
        topic: topic ? sanitizePresentationTopic(topic) : null,
        slot: slot ? sanitizePresentationSlot(slot, booking, user) : null,
        allowSecondAttempt: user.allowPresentationAttemptTwo === true,
        evaluation: latestEvaluation ? sanitizePresentationEvaluation(latestEvaluation) : null,
        evaluations: (isAdminViewer ? evaluationAttempts : myEvaluationAttempts)
          .map((item) => sanitizePresentationEvaluationWithEvaluator(item, allUsersMap.get(String(item.evaluatorUserId || '')) || null)),
        attempt1Average: averageScores(attempt1Evaluations),
        attempt2Average: averageScores(attempt2Evaluations),
        myEvaluation: (() => {
          const mine = myEvaluationAttempts
            .slice()
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
          return mine ? sanitizePresentationEvaluationWithEvaluator(mine, allUsersMap.get(String(mine.evaluatorUserId || '')) || null) : null;
        })(),
        myEvaluations: myEvaluationAttempts.map((item) =>
          sanitizePresentationEvaluationWithEvaluator(item, allUsersMap.get(String(item.evaluatorUserId || '')) || null)
        )
      };
    })
    .filter((item) => item.topic);

  const activeSlots = slotsForYear.filter((slot) => slot.isActive !== false);
  const bookedSlotIds = new Set(bookingsForYear.map((booking) => String(booking.slotId)));
  const filteredEvaluations = presenters.flatMap((presenter) => presenter.evaluations || []);
  const scores = filteredEvaluations.map((item) => item.totalScore || 0);
  const totalScore = scores.reduce((sum, value) => sum + value, 0);

  const stats = {
    totalTopics: topicsForYear.length,
    availableTopics: topicsForYear.filter((topic) => !topic.isAssigned).length,
    assignedTopics: topicsForYear.filter((topic) => topic.isAssigned).length,
    totalSlots: activeSlots.length,
    openSlots: activeSlots.filter((slot) => !bookedSlotIds.has(String(slot._id))).length,
    bookedPresentations: bookingsForYear.length,
    evaluatedPresentations: filteredEvaluations.length,
    averageScore: scores.length ? Number((totalScore / scores.length).toFixed(2)) : 0
  };

  const result = {
    stats,
    selectedYear,
    availableYears,
    presenters,
    activeCriteria: criteria
      .filter((criterion) => criterion.isActive !== false)
      .map(sanitizePresentationCriterion)
  };

  if (account.role === 'new recruit') {
    const topic = topicByAssignedTo.get(String(account._id)) || null;
    const booking = bookingByUserId.get(String(account._id)) || null;
    const bookedSlotId = booking ? String(booking.slotId) : null;
    const recruitSlots = activeSlots
      .filter((slot) => selectedYear !== getCurrentPresentationYear() || new Date(slot.startAt) >= now())
      .map((slot) =>
      sanitizePresentationSlot(
        slot,
        bookingsForYear.find((item) => String(item.slotId) === String(slot._id)) || null,
        usersMap.get(
          String(
            (bookingsForYear.find((item) => String(item.slotId) === String(slot._id)) || {}).userId || ''
          )
        ) || null
      )
    );

    result.recruit = {
      canSpin: !topic,
      topic: topic ? sanitizePresentationTopic(topic) : null,
      booking:
        booking && slotById.get(bookedSlotId)
          ? sanitizePresentationSlot(slotById.get(bookedSlotId), booking, account)
          : null,
      availableTopicTitles: topicsForYear.filter((item) => !item.isAssigned).map((item) => item.title),
      slots: recruitSlots
    };
  }

  if (isAdminAccount(account)) {
    const allUsers = await usersCollection().find({ _id: { $in: recruitIds } }).toArray();
    const adminUsersMap = new Map(allUsers.map((user) => [String(user._id), user]));

    result.admin = {
      topics: topicsForYear.map(sanitizePresentationTopic),
      slots: await hydratePresentationSlots(slotsForYear, bookingsForYear, adminUsersMap),
      criteria: criteria.map(sanitizePresentationCriterion),
      evaluations: presenters
        .filter((presenter) => presenter.evaluations?.length)
        .map((presenter) => ({
          presenter: presenter.user,
          topic: presenter.topic,
          slot: presenter.slot,
          evaluations: presenter.evaluations
        }))
    };
  }

  return result;
}

async function buildPresentationReport(options = {}) {
  const dashboard = await buildPresentationDashboard({ role: 'admin', _id: null }, options);
  const rankings = dashboard.presenters
    .map((presenter) => ({
      presenter: presenter.user.displayName,
      username: presenter.user.username,
      allowSecondAttempt: presenter.allowSecondAttempt === true,
      topic: presenter.topic?.title || 'Unassigned',
      slot: presenter.slot?.startAt || null,
      attempt1Score: presenter.attempt1Average ?? null,
      attempt1Breakdown: (presenter.evaluations || [])
        .filter((evaluation) => evaluation.attempt === 1)
        .map((evaluation) => ({
          evaluator: evaluation.evaluator?.displayName || evaluation.evaluator?.username || 'Unknown evaluator',
          score: evaluation.totalScore
        })),
      attempt2Score: presenter.allowSecondAttempt ? (presenter.attempt2Average ?? null) : null,
      attempt2Breakdown: presenter.allowSecondAttempt
        ? (presenter.evaluations || [])
          .filter((evaluation) => evaluation.attempt === 2)
          .map((evaluation) => ({
            evaluator: evaluation.evaluator?.displayName || evaluation.evaluator?.username || 'Unknown evaluator',
            score: evaluation.totalScore
          }))
        : [],
      totalScore: presenter.attempt2Average ?? presenter.attempt1Average ?? null,
      scoredAt: presenter.evaluation?.updatedAt || null
    }))
    .sort((a, b) => (b.totalScore || -1) - (a.totalScore || -1));

  return {
    generatedAt: formatDateTime(now()),
    selectedYear: dashboard.selectedYear,
    availableYears: dashboard.availableYears,
    summary: dashboard.stats,
    rankings
  };
}

app.get('/api/health', async (req, res) => {
  const telegram = await readTelegramSettings();
  res.json({
    ok: true,
    database: DATABASE_NAME,
    dataFile,
    telegramConfigured: Boolean(telegram.botToken && telegram.defaultChatId)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both your username and password.' });
  }

  const user = await usersCollection().findOne({ username: String(username).trim() });

  if (!user || user.active === false) {
    return res.status(401).json({ error: 'The username or password you entered is incorrect.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: 'The username or password you entered is incorrect.' });
  }

  const token = signAuthToken(user);
  return res.json({
    token,
    user: sanitizeUser(user)
  });
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password, displayName, birthdate, role = 'member' } = req.body || {};

  if (!username || !password || !displayName || !birthdate) {
    return res.status(400).json({ error: 'Please complete all required signup fields before continuing.' });
  }

  if (!['member', 'new recruit'].includes(role)) {
    return res.status(400).json({ error: 'Please select either Member or New Recruit.' });
  }

  if (!isValidBirthdate(birthdate)) {
    return res.status(400).json({ error: 'Please enter a valid date of birth.' });
  }

  const trimmedUsername = String(username).trim();
  const trimmedDisplayName = String(displayName).trim();

  if (!trimmedUsername || !trimmedDisplayName) {
    return res.status(400).json({ error: 'Please complete both the username and full name fields.' });
  }

  const [existingUser, duplicateBirthday] = await Promise.all([
    usersCollection().findOne({ username: trimmedUsername }),
    birthdaysCollection().findOne({
      normalizedName: normalizeName(trimmedDisplayName),
      birthdate
    })
  ]);

  if (existingUser) {
    return res.status(409).json({ error: 'This username is already in use. Please choose another one.' });
  }

  if (duplicateBirthday) {
    return res.status(409).json({ error: 'A birthday record with these details already exists.' });
  }

  const createdAt = now();
  const user = {
    username: trimmedUsername,
    passwordHash: await bcrypt.hash(String(password), 10),
    displayName: trimmedDisplayName,
    role,
    moduleAccess: normalizeModuleAccess(role, createSignupModuleAccess(role)),
    active: true,
    createdAt,
    updatedAt: createdAt
  };

  const userResult = await usersCollection().insertOne(user);

  try {
    await birthdaysCollection().insertOne({
      userId: userResult.insertedId,
      name: trimmedDisplayName,
      normalizedName: normalizeName(trimmedDisplayName),
      birthdate,
      active: true,
      createdBy: trimmedUsername,
      createdAt,
      updatedAt: createdAt
    });
  } catch (error) {
    await usersCollection().deleteOne({ _id: userResult.insertedId });

    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A birthday record with these details already exists.' });
    }

    throw error;
  }

  const nextUser = { ...user, _id: userResult.insertedId };
  const token = signAuthToken(nextUser);

  return res.status(201).json({
    token,
    user: sanitizeUser(nextUser)
  });
});

app.post('/api/recruitment-interest', async (req, res) => {
  const { firstName, lastName, phoneNumber, dateOfBirth } = req.body || {};
  const trimmedFirstName = String(firstName || '').trim();
  const trimmedLastName = String(lastName || '').trim();
  const trimmedPhoneNumber = String(phoneNumber || '').trim();

  if (!trimmedFirstName || !trimmedLastName || !trimmedPhoneNumber || !dateOfBirth) {
    return res.status(400).json({ error: 'Please complete first name, last name, phone number, and date of birth.' });
  }

  const duplicate = await findExistingRecruitmentInterestLead({
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    dateOfBirth,
    phoneNumber: trimmedPhoneNumber
  });

  if (duplicate) {
    return res.status(409).json({ error: 'This person is already registered in the recruitment interest list.' });
  }

  const createdAt = now();
  const payload = {
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    normalizedFullName: normalizeName(`${trimmedFirstName} ${trimmedLastName}`),
    dateOfBirth: formatDateOnly(dateOfBirth),
    phoneNumber: trimmedPhoneNumber,
    normalizedPhoneNumber: normalizePhoneNumber(trimmedPhoneNumber),
    callStatus: '',
    lastCallDate: '',
    followUpDate: '',
    notes: '',
    updatedByName: '',
    callHistory: [],
    createdAt,
    updatedAt: createdAt
  };

  const result = await recruitmentInterestLeadsCollection().insertOne(payload);
  res.status(201).json(sanitizeRecruitmentInterestLead({ ...payload, _id: result.insertedId }));
});

app.use('/api', authMiddleware, requireAuthenticatedUser);

const requireBloodDriveAccess = requireModuleAccess('bloodDrive');
const requireRecruitmentAccess = requireModuleAccess('recruitment');
const requirePresentationsAccess = requireModuleAccess('presentations');

app.get('/api/me', async (req, res) => {
  const [summary, telegram, ownBirthdays] = await Promise.all([
    isAdminAccount(req.account) ? buildDashboardSummary() : Promise.resolve(null),
    readTelegramSettings(),
    birthdaysCollection()
      .find({ userId: req.account._id })
      .sort({ birthdate: 1 })
      .toArray()
  ]);

  res.json({
    user: sanitizeUser(req.account),
    summary,
    telegram: {
      timezone: telegram.timezone,
      hasBotToken: Boolean(telegram.botToken),
      defaultChatId: telegram.defaultChatId
    },
    ownBirthdays: ownBirthdays.map(sanitizeBirthday)
  });
});

app.get('/api/users', requireRole('admin'), async (req, res) => {
  const users = await usersCollection().find().sort({ role: 1, username: 1 }).toArray();
  res.json(users.map(sanitizeUser));
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  const {
    username,
    password,
    displayName,
    role = 'member',
    active = true,
    moduleAccess = createDefaultModuleAccess(role)
  } = req.body || {};

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'Please complete the username, full name, and password fields.' });
  }

  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Please choose a valid user role.' });
  }

  const trimmedUsername = String(username).trim();
  const existing = await usersCollection().findOne({ username: trimmedUsername });

  if (existing) {
    return res.status(409).json({ error: 'This username is already in use. Please choose another one.' });
  }

  const user = {
    username: trimmedUsername,
    passwordHash: await bcrypt.hash(String(password), 10),
    displayName: String(displayName).trim(),
    role,
    moduleAccess: normalizeModuleAccess(role, moduleAccess),
    active: Boolean(active),
    createdAt: now(),
    updatedAt: now()
  };

  const result = await usersCollection().insertOne(user);
  res.status(201).json(sanitizeUser({ ...user, _id: result.insertedId }));
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  const userId = toObjectId(req.params.id);

  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const existing = await usersCollection().findOne({ _id: userId });

  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, password, displayName, role, active, moduleAccess } = req.body || {};
  const updates = { updatedAt: now() };
  let resolvedRole = existing.role;

  if (typeof username === 'string' && username.trim()) {
    const trimmedUsername = username.trim();
    const collision = await usersCollection().findOne({
      username: trimmedUsername,
      _id: { $ne: userId }
    });

    if (collision) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    updates.username = trimmedUsername;
  }

  if (typeof displayName === 'string' && displayName.trim()) {
    updates.displayName = displayName.trim();
  }

  if (typeof password === 'string' && password.trim()) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (role !== undefined) {
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be admin, member, or new recruit' });
    }

    updates.role = role;
    resolvedRole = role;
  }

  if (moduleAccess !== undefined || role !== undefined) {
    updates.moduleAccess = normalizeModuleAccess(
      resolvedRole,
      moduleAccess !== undefined ? moduleAccess : existing.moduleAccess
    );
  }

  if (typeof active === 'boolean') {
    updates.active = active;
  }

  await usersCollection().updateOne({ _id: userId }, { $set: updates });
  const nextUser = await usersCollection().findOne({ _id: userId });
  res.json(sanitizeUser(nextUser));
});

app.get('/api/birthdays', async (req, res) => {
  const query = isAdminAccount(req.account) ? {} : { userId: req.account._id };
  const birthdays = await birthdaysCollection().find(query).sort({ birthdate: 1, name: 1 }).toArray();
  res.json(birthdays.map(sanitizeBirthday));
});

app.post('/api/birthdays', async (req, res) => {
  const { userId, name, birthdate, active = true } = req.body || {};

  if (!birthdate || !isValidBirthdate(birthdate)) {
    return res.status(400).json({ error: 'Please enter a valid birthday in MM-DD format.' });
  }

  const entryUserId = isAdminAccount(req.account) && userId ? toObjectId(userId) : req.account._id;
  const fallbackName = req.account.displayName || req.account.username;
  const nextName = String(name || fallbackName).trim();

  if (!nextName) {
    return res.status(400).json({ error: 'Please enter a name before saving.' });
  }

  if (!isAdminAccount(req.account)) {
    const existingOwnBirthday = await birthdaysCollection().findOne({ userId: req.account._id });
    if (existingOwnBirthday) {
      return res.status(409).json({ error: 'You already have a saved birthday record.' });
    }
  }

  const duplicate = await birthdaysCollection().findOne({
    normalizedName: normalizeName(nextName),
    birthdate
  });

  if (duplicate) {
    return res.status(409).json({ error: 'A birthday record with these details already exists.' });
  }

  const entry = {
    userId: entryUserId || null,
    name: nextName,
    normalizedName: normalizeName(nextName),
    birthdate,
    active: Boolean(active),
    createdBy: req.account.username,
    createdAt: now(),
    updatedAt: now()
  };

  const result = await birthdaysCollection().insertOne(entry);
  res.status(201).json(sanitizeBirthday({ ...entry, _id: result.insertedId }));
});

app.put('/api/birthdays/:id', async (req, res) => {
  const birthday = await getBirthdayById(req.params.id);

  if (!birthday) {
    return res.status(404).json({ error: 'The selected birthday record could not be found.' });
  }

  if (!isAdminAccount(req.account) && String(birthday.userId || '') !== String(req.account._id)) {
    return res.status(403).json({ error: 'You do not have permission to update this birthday record.' });
  }

  const { name, birthdate, active } = req.body || {};
  const updates = { updatedAt: now() };

  if (birthdate !== undefined) {
    if (!isValidBirthdate(birthdate)) {
      return res.status(400).json({ error: 'Please enter a valid birthday in MM-DD format.' });
    }
    updates.birthdate = birthdate;
  }

  if (typeof name === 'string' && name.trim()) {
    updates.name = name.trim();
    updates.normalizedName = normalizeName(name);
  }

  if (typeof active === 'boolean') {
    updates.active = active;
  }

  const nextName = updates.name || birthday.name;
  const nextBirthdate = updates.birthdate || birthday.birthdate;
  const duplicate = await birthdaysCollection().findOne({
    _id: { $ne: birthday._id },
    normalizedName: normalizeName(nextName),
    birthdate: nextBirthdate
  });

  if (duplicate) {
    return res.status(409).json({ error: 'A birthday record with these details already exists.' });
  }

  await birthdaysCollection().updateOne({ _id: birthday._id }, { $set: updates });
  const updated = await birthdaysCollection().findOne({ _id: birthday._id });
  res.json(sanitizeBirthday(updated));
});

app.delete('/api/birthdays/:id', async (req, res) => {
  const birthday = await getBirthdayById(req.params.id);

  if (!birthday) {
    return res.status(404).json({ error: 'The selected birthday record could not be found.' });
  }

  if (!isAdminAccount(req.account) && String(birthday.userId || '') !== String(req.account._id)) {
    return res.status(403).json({ error: 'You do not have permission to delete this birthday record.' });
  }

  await birthdaysCollection().deleteOne({ _id: birthday._id });
  return res.status(204).send();
});

app.get('/api/blood-drive/donors', requireBloodDriveAccess, async (req, res) => {
  const today = formatDateOnly(now());
  const nameFilter = String(req.query.name || '').trim();
  const locationFilter = String(req.query.location || '').trim();
  const phoneFilter = normalizePhoneNumber(req.query.phone || '');
  const eligibleOnly = String(req.query.eligibleOnly || 'true') !== 'false';
  const limit = Math.min(Math.max(Number(req.query.limit || 0), 0), 50);

  const query = {};

  if (eligibleOnly) {
    query.nextEligibleDonationDate = { $lte: today };
  }

  if (nameFilter) {
    query.normalizedFullName = { $regex: escapeRegex(normalizeName(nameFilter)) };
  }

  if (locationFilter) {
    query.$or = [
      ...(query.$or || []),
      { location: { $regex: `^${escapeRegex(locationFilter)}$`, $options: 'i' } },
      { locationHistory: { $regex: `^${escapeRegex(locationFilter)}$`, $options: 'i' } }
    ];
  }

  if (phoneFilter) {
    query.$or = [
      { normalizedPhoneNumber: { $regex: escapeRegex(phoneFilter) } },
      { phoneNumber: { $regex: escapeRegex(String(req.query.phone || '').trim()) } }
    ];
  }

  let cursor = bloodDonorsCollection()
    .find(query)
    .sort({ nextEligibleDonationDate: 1, lastName: 1, firstName: 1 });

  if (limit > 0) {
    cursor = cursor.limit(limit);
  }

  const donors = await cursor.toArray();

  res.json(
    donors.map((donor) =>
      sanitizeBloodDonor({ ...donor, isEligible: donor.nextEligibleDonationDate <= today })
    )
  );
});

app.get('/api/blood-drive/stats', requireBloodDriveAccess, async (req, res) => {
  const today = formatDateOnly(now());
  const [total, eligible, upcoming, locationRows, ageRows] = await Promise.all([
    bloodDonorsCollection().countDocuments(),
    bloodDonorsCollection().countDocuments({ nextEligibleDonationDate: { $lte: today } }),
    bloodDonorsCollection().countDocuments({ nextEligibleDonationDate: { $gt: today } }),
    bloodDonorsCollection().aggregate([
      {
        $group: {
          _id: { $ifNull: ['$location', 'Unspecified'] },
          value: { $sum: 1 }
        }
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1, label: 1 } }
    ]).toArray(),
    bloodDonorsCollection().find({}, { projection: { dateOfBirth: 1 } }).toArray()
  ]);

  const byAgeGroup = {
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45+': 0
  };

  for (const donor of ageRows) {
    const donorAge = calculateAgeFromDateOfBirth(donor.dateOfBirth);
    if (donorAge === null) continue;
    if (donorAge >= 45) byAgeGroup['45+'] += 1;
    else if (donorAge >= 35) byAgeGroup['35-44'] += 1;
    else if (donorAge >= 25) byAgeGroup['25-34'] += 1;
    else byAgeGroup['18-24'] += 1;
  }

  res.json({
    totals: { total, eligible, upcoming },
    byLocation: locationRows,
    byAgeGroup: Object.entries(byAgeGroup).map(([label, value]) => ({ label, value }))
  });
});

app.get('/api/blood-drive/locations', requireBloodDriveAccess, async (req, res) => {
  const activeOnly = String(req.query.activeOnly || 'true') !== 'false';
  const query = activeOnly ? { active: true } : {};
  const locations = await donationLocationsCollection().find(query).sort({ active: -1, name: 1 }).toArray();
  res.json(locations.map(sanitizeDonationLocation));
});

app.post('/api/blood-drive/locations', requireRole('admin'), async (req, res) => {
  const { name, active = true } = req.body || {};
  const trimmedName = String(name || '').trim();

  if (!trimmedName) {
    return res.status(400).json({ error: 'Please enter a location name.' });
  }

  const payload = {
    name: trimmedName,
    normalizedName: normalizeName(trimmedName),
    active: Boolean(active),
    createdAt: now(),
    updatedAt: now()
  };

  try {
    const result = await donationLocationsCollection().insertOne(payload);
    return res.status(201).json(sanitizeDonationLocation({ ...payload, _id: result.insertedId }));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This donation location already exists.' });
    }

    throw error;
  }
});

app.put('/api/blood-drive/locations/:id', requireRole('admin'), async (req, res) => {
  const locationId = toObjectId(req.params.id);

  if (!locationId) {
    return res.status(400).json({ error: 'The selected donation location is invalid.' });
  }

  const existing = await donationLocationsCollection().findOne({ _id: locationId });

  if (!existing) {
    return res.status(404).json({ error: 'The selected donation location could not be found.' });
  }

  const { name, active } = req.body || {};
  const updates = { updatedAt: now() };

  if (typeof name === 'string' && name.trim()) {
    const trimmedName = name.trim();
    const collision = await donationLocationsCollection().findOne({
      normalizedName: normalizeName(trimmedName),
      _id: { $ne: locationId }
    });

    if (collision) {
      return res.status(409).json({ error: 'This donation location already exists.' });
    }

    updates.name = trimmedName;
    updates.normalizedName = normalizeName(trimmedName);
  }

  if (typeof active === 'boolean') {
    updates.active = active;
  }

  await donationLocationsCollection().updateOne({ _id: locationId }, { $set: updates });
  const updated = await donationLocationsCollection().findOne({ _id: locationId });
  res.json(sanitizeDonationLocation(updated));
});

app.get('/api/blood-drive/donors/export', requireRole('admin'), requireBloodDriveAccess, async (req, res) => {
  const requestedDate = String(req.query.date || formatDateOnly(now())).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
  }

  const donors = await bloodDonorsCollection()
    .find({ lastDonationDate: requestedDate })
    .sort({ lastName: 1, firstName: 1 })
    .toArray();

  const rows = donors.map((donor) => ({
    fullName: `${donor.firstName || ''} ${donor.lastName || ''}`.trim(),
    firstName: donor.firstName || '',
    lastName: donor.lastName || '',
    age: calculateAgeFromDateOfBirth(donor.dateOfBirth) ?? '',
    dateOfBirth: donor.dateOfBirth || '',
    phoneNumber: donor.phoneNumber || '',
    location: donor.location || '',
    donationDate: donor.lastDonationDate || '',
    updatedByName: donor.updatedByName || '',
    notes: donor.notes || ''
  }));

  const headerCells = [
    'Full Name',
    'First Name',
    'Last Name',
    'Age',
    'Date of Birth',
    'Phone Number',
    'Location',
    'Donation Date',
    'Updated By',
    'Notes'
  ].map((label) => `<Cell><Data ss:Type="String">${escapeXml(label)}</Data></Cell>`).join('');

  const bodyRows = rows.map((row) => `
    <Row>
      <Cell><Data ss:Type="String">${escapeXml(row.fullName)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.firstName)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.lastName)}</Data></Cell>
      <Cell><Data ss:Type="${row.age === '' ? 'String' : 'Number'}">${escapeXml(row.age)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.dateOfBirth)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.phoneNumber)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.location)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.donationDate)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.updatedByName)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(row.notes)}</Data></Cell>
    </Row>`).join('');

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Donations">
    <Table>
      <Row>${headerCells}</Row>${bodyRows}
    </Table>
  </Worksheet>
</Workbook>`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename="blood-donations-${requestedDate}.xls"`);
  res.send(workbook);
});

app.get('/api/recruitment-interest', requireRecruitmentAccess, async (req, res) => {
  const nameFilter = String(req.query.name || '').trim();
  const statusFilter = String(req.query.status || '').trim();
  const query = {};

  if (nameFilter) {
    query.normalizedFullName = { $regex: escapeRegex(normalizeName(nameFilter)) };
  }

  if (statusFilter) {
    query.callStatus = statusFilter;
  }

  const leads = await recruitmentInterestLeadsCollection()
    .find(query)
    .sort({ createdAt: -1, lastName: 1, firstName: 1 })
    .toArray();

  res.json(leads.map(sanitizeRecruitmentInterestLead));
});

app.put('/api/recruitment-interest/:id/contact', requireRecruitmentAccess, async (req, res) => {
  const leadId = toObjectId(req.params.id);

  if (!leadId) {
    return res.status(400).json({ error: 'The selected recruitment record is invalid.' });
  }

  const lead = await recruitmentInterestLeadsCollection().findOne({ _id: leadId });

  if (!lead) {
    return res.status(404).json({ error: 'The selected recruitment record could not be found.' });
  }

  const { callStatus, followUpDate, notes } = req.body || {};
  const normalizedStatus = typeof callStatus === 'string' ? callStatus.trim() : '';
  const callDate = formatDateOnly(now());

  if (!normalizedStatus) {
    return res.status(400).json({ error: 'Please select a call result before saving.' });
  }

  const normalizedFollowUpDate = ['follow-up', 'scheduled'].includes(normalizedStatus) && followUpDate
    ? formatDateOnly(followUpDate)
    : '';

  const updates = {
    callStatus: normalizedStatus,
    followUpDate: normalizedFollowUpDate,
    lastCallDate: callDate,
    notes: typeof notes === 'string' ? notes.trim() : (lead.notes || ''),
    updatedByName: req.account.displayName || req.account.username,
    updatedAt: now(),
    callHistory: [
      {
        callDate,
        callStatus: normalizedStatus,
        followUpDate: normalizedFollowUpDate,
        notes: typeof notes === 'string' ? notes.trim() : (lead.notes || ''),
        recordedByName: req.account.displayName || req.account.username
      },
      ...(Array.isArray(lead.callHistory) ? lead.callHistory : [])
    ]
  };

  await recruitmentInterestLeadsCollection().updateOne({ _id: leadId }, { $set: updates });
  const updated = await recruitmentInterestLeadsCollection().findOne({ _id: leadId });
  res.json(sanitizeRecruitmentInterestLead(updated));
});

app.get('/api/blood-drive/my-record', requireBloodDriveAccess, async (req, res) => {
  const donor = await bloodDonorsCollection().findOne({ userId: req.account._id });

  if (!donor) {
    return res.json(null);
  }

  const today = formatDateOnly(now());
  return res.json(sanitizeBloodDonor({ ...donor, isEligible: donor.nextEligibleDonationDate <= today }));
});

app.post('/api/blood-drive/donors/prospects', requireBloodDriveAccess, async (req, res) => {
  const { firstName, lastName, dateOfBirth, phoneNumber, notes } = req.body || {};
  const trimmedFirstName = String(firstName || '').trim();
  const trimmedLastName = String(lastName || '').trim();
  const trimmedPhoneNumber = String(phoneNumber || '').trim();

  if (!trimmedFirstName || !trimmedLastName || !trimmedPhoneNumber || !dateOfBirth) {
    return res
      .status(400)
      .json({ error: 'Please complete first name, last name, phone number, and date of birth.' });
  }

  const numericAge = calculateAgeFromDateOfBirth(dateOfBirth);

  if (!Number.isFinite(numericAge) || numericAge < 18 || numericAge > 75) {
    return res.status(400).json({ error: 'The date of birth must correspond to an age between 18 and 75.' });
  }

  const duplicate = await findExistingBloodDonor({
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    dateOfBirth,
    phoneNumber: trimmedPhoneNumber
  });
  if (duplicate) {
    return res.status(409).json({ error: 'This donor is already in the repository. Please use the existing record instead of creating a new one.' });
  }

  const currentDate = now();
  const today = formatDateOnly(currentDate);
  const payload = {
    userId: null,
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    normalizedFullName: normalizeName(`${trimmedFirstName} ${trimmedLastName}`),
    dateOfBirth: formatDateOnly(dateOfBirth),
    phoneNumber: trimmedPhoneNumber,
    normalizedPhoneNumber: normalizePhoneNumber(trimmedPhoneNumber),
    location: '',
    locationHistory: [],
    contacted: false,
    willingToDonate: false,
    callStatus: '',
    lastCallDate: '',
    upcomingDonationDate: '',
    callHistory: [],
    notes: typeof notes === 'string' ? notes.trim() : '',
    lastDonationDate: '',
    lastUpdatedDate: today,
    updatedByUserId: req.account._id,
    updatedByName: req.account.displayName || req.account.username,
    nextEligibleDonationDate: today,
    updatedAt: currentDate,
    createdAt: currentDate
  };

  const result = await bloodDonorsCollection().insertOne(payload);
  return res.status(201).json(
    sanitizeBloodDonor({
      ...payload,
      _id: result.insertedId,
      isEligible: payload.nextEligibleDonationDate <= today
    })
  );
});

app.post('/api/blood-drive/donors', requireBloodDriveAccess, async (req, res) => {
  const { donorId, firstName, lastName, dateOfBirth, phoneNumber, location, notes } = req.body || {};

  if (!firstName || !lastName || !phoneNumber || !location || !dateOfBirth) {
    return res
      .status(400)
      .json({ error: 'Please complete first name, last name, date of birth, phone number, and location.' });
  }

  const numericAge = calculateAgeFromDateOfBirth(dateOfBirth);

  if (!Number.isFinite(numericAge) || numericAge < 18 || numericAge > 75) {
    return res.status(400).json({ error: 'The date of birth must correspond to an age between 18 and 75.' });
  }

  const currentDate = now();
  const lastUpdatedDate = formatDateOnly(currentDate);
  const nextEligibleDonationDate = formatDateOnly(addMonths(currentDate, 3));
  const basePayload = {
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    normalizedFullName: normalizeName(`${firstName} ${lastName}`),
    dateOfBirth: formatDateOnly(dateOfBirth),
    phoneNumber: String(phoneNumber).trim(),
    normalizedPhoneNumber: normalizePhoneNumber(phoneNumber),
    location: String(location).trim(),
    locationHistory: [],
    contacted: false,
    willingToDonate: false,
    callStatus: '',
    lastCallDate: '',
    upcomingDonationDate: '',
    callHistory: [],
    notes: typeof notes === 'string' ? notes.trim() : '',
    lastDonationDate: lastUpdatedDate,
    lastUpdatedDate,
    updatedByUserId: req.account._id,
    updatedByName: req.account.displayName || req.account.username,
    nextEligibleDonationDate,
    updatedAt: currentDate
  };

  if (donorId) {
    const donor = await getBloodDonorById(donorId);
    if (!donor) {
      return res.status(404).json({ error: 'The selected blood donor record could not be found.' });
    }

    const duplicate = await findExistingBloodDonor({
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      excludeId: donor._id
    });

    if (duplicate) {
      return res.status(409).json({ error: 'These donor details already match another record in the repository.' });
    }

    const updates = {
      ...basePayload,
      locationHistory: buildLocationHistory(donor.locationHistory, String(location).trim()),
      userId: donor.userId || req.account._id,
      contacted: donor.contacted === true,
      willingToDonate: donor.willingToDonate === true,
      callStatus: donor.callStatus || '',
      lastCallDate: donor.lastCallDate || '',
      upcomingDonationDate: '',
      callHistory: Array.isArray(donor.callHistory) ? donor.callHistory : [],
      notes: typeof notes === 'string' ? notes.trim() : (donor.notes || '')
    };

    await bloodDonorsCollection().updateOne({ _id: donor._id }, { $set: updates });
    const updated = await bloodDonorsCollection().findOne({ _id: donor._id });
    return res.json(
      sanitizeBloodDonor({
        ...updated,
        isEligible: updated.nextEligibleDonationDate <= lastUpdatedDate
      })
    );
  }

  if (!isAdminAccount(req.account)) {
    const existing = await bloodDonorsCollection().findOne({ userId: req.account._id });

    if (existing) {
      await bloodDonorsCollection().updateOne({
        _id: existing._id
      }, {
        $set: {
          ...basePayload,
          locationHistory: buildLocationHistory(existing.locationHistory, String(location).trim()),
          userId: req.account._id,
          contacted: existing.contacted === true,
          willingToDonate: existing.willingToDonate === true,
          callStatus: existing.callStatus || '',
          lastCallDate: existing.lastCallDate || '',
          upcomingDonationDate: '',
          callHistory: Array.isArray(existing.callHistory) ? existing.callHistory : [],
          notes: typeof notes === 'string' ? notes.trim() : (existing.notes || '')
        }
      });
      const updated = await bloodDonorsCollection().findOne({ _id: existing._id });
      return res.json(
        sanitizeBloodDonor({
          ...updated,
          isEligible: updated.nextEligibleDonationDate <= lastUpdatedDate
        })
      );
    }
  }

  const duplicate = await findExistingBloodDonor({ firstName, lastName, dateOfBirth, phoneNumber });
  if (duplicate) {
    const updates = {
      ...basePayload,
      locationHistory: buildLocationHistory(duplicate.locationHistory, String(location).trim()),
      userId: duplicate.userId || req.account._id,
      contacted: duplicate.contacted === true,
      willingToDonate: duplicate.willingToDonate === true,
      callStatus: duplicate.callStatus || '',
      lastCallDate: duplicate.lastCallDate || '',
      upcomingDonationDate: '',
      callHistory: Array.isArray(duplicate.callHistory) ? duplicate.callHistory : [],
      notes: typeof notes === 'string' ? notes.trim() : (duplicate.notes || '')
    };

    await bloodDonorsCollection().updateOne({ _id: duplicate._id }, { $set: updates });
    const updated = await bloodDonorsCollection().findOne({ _id: duplicate._id });
    return res.json(
      sanitizeBloodDonor({
        ...updated,
        isEligible: updated.nextEligibleDonationDate <= lastUpdatedDate
      })
    );
  }

  const payload = {
    ...basePayload,
    locationHistory: buildLocationHistory([], String(location).trim()),
    userId: req.account._id
  };

  const result = await bloodDonorsCollection().insertOne({
    ...payload,
    createdAt: currentDate
  });

  return res.status(201).json(
    sanitizeBloodDonor({
      ...payload,
      _id: result.insertedId,
      isEligible: nextEligibleDonationDate <= lastUpdatedDate
    })
  );
});

app.put('/api/blood-drive/donors/:id/contact', requireBloodDriveAccess, async (req, res) => {
  const donor = await getBloodDonorById(req.params.id);

  if (!donor) {
    return res.status(404).json({ error: 'The selected blood donor record could not be found.' });
  }

  const { contacted, willingToDonate, callStatus, upcomingDonationDate, notes } = req.body || {};
  const recordedAt = now();
  const callDate = formatDateOnly(recordedAt);
  const normalizedStatus = typeof callStatus === 'string' ? callStatus.trim() : '';
  const derivedCallStatus = normalizedStatus || (contacted ? (willingToDonate ? 'upcoming' : 'not-willing') : '');
  if (derivedCallStatus === 'upcoming' && !upcomingDonationDate) {
    return res.status(400).json({ error: 'Please select an upcoming donation date when the donor plans to come later.' });
  }
  const normalizedUpcomingDonationDate = derivedCallStatus === 'upcoming' && upcomingDonationDate
    ? formatDateOnly(upcomingDonationDate)
    : '';
  const updates = {
    updatedAt: recordedAt,
    lastUpdatedDate: callDate,
    updatedByUserId: req.account._id,
    updatedByName: req.account.displayName || req.account.username,
    lastCallDate: callDate,
    callStatus: derivedCallStatus,
    upcomingDonationDate: normalizedUpcomingDonationDate
  };

  updates.contacted = Boolean(derivedCallStatus);
  updates.willingToDonate = derivedCallStatus === 'upcoming';

  if (typeof notes === 'string') {
    updates.notes = notes.trim();
  }

  updates.callHistory = [
    {
      callDate,
      callStatus: derivedCallStatus,
      upcomingDonationDate: normalizedUpcomingDonationDate,
      notes: typeof notes === 'string' ? notes.trim() : (donor.notes || ''),
      recordedByName: req.account.displayName || req.account.username
    },
    ...(Array.isArray(donor.callHistory) ? donor.callHistory : [])
  ];

  await bloodDonorsCollection().updateOne({ _id: donor._id }, { $set: updates });
  const updated = await bloodDonorsCollection().findOne({ _id: donor._id });
  res.json(sanitizeBloodDonor({ ...updated, isEligible: updated.nextEligibleDonationDate <= formatDateOnly(now()) }));
});

app.put('/api/blood-drive/donors/:id', requireRole('admin'), requireBloodDriveAccess, async (req, res) => {
  const donor = await getBloodDonorById(req.params.id);

  if (!donor) {
    return res.status(404).json({ error: 'The selected blood donor record could not be found.' });
  }

  const { firstName, lastName, dateOfBirth, phoneNumber, location, contacted, willingToDonate, notes } = req.body || {};
  const updates = {};

  if (typeof firstName === 'string' && firstName.trim()) {
    updates.firstName = firstName.trim();
  }

  if (typeof lastName === 'string' && lastName.trim()) {
    updates.lastName = lastName.trim();
  }

  if (dateOfBirth !== undefined) {
    const numericAge = calculateAgeFromDateOfBirth(dateOfBirth);
    if (!Number.isFinite(numericAge) || numericAge < 18 || numericAge > 75) {
      return res.status(400).json({ error: 'The date of birth must correspond to an age between 18 and 75.' });
    }
    updates.dateOfBirth = formatDateOnly(dateOfBirth);
  }

  if (typeof phoneNumber === 'string' && phoneNumber.trim()) {
    updates.phoneNumber = phoneNumber.trim();
  }

  if (typeof location === 'string' && location.trim()) {
    updates.location = location.trim();
    updates.locationHistory = buildLocationHistory(donor.locationHistory, location.trim());
  }

  if (typeof phoneNumber === 'string' && phoneNumber.trim()) {
    updates.normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  }

  if (typeof contacted === 'boolean') {
    updates.contacted = contacted;
  }

  if (typeof willingToDonate === 'boolean') {
    updates.willingToDonate = willingToDonate;
  }

  if (typeof notes === 'string') {
    updates.notes = notes.trim();
  }

  const nextFirstName = updates.firstName || donor.firstName;
  const nextLastName = updates.lastName || donor.lastName;
  const nextDateOfBirth = updates.dateOfBirth || donor.dateOfBirth;
  const nextPhoneNumber = updates.phoneNumber || donor.phoneNumber;
  const duplicate = await findExistingBloodDonor({
    firstName: nextFirstName,
    lastName: nextLastName,
    dateOfBirth: nextDateOfBirth,
    phoneNumber: nextPhoneNumber,
    excludeId: donor._id
  });

  if (duplicate) {
    return res.status(409).json({ error: 'These donor details already match another record in the repository.' });
  }

  updates.normalizedFullName = normalizeName(`${nextFirstName} ${nextLastName}`);

  await bloodDonorsCollection().updateOne({ _id: donor._id }, { $set: updates });
  const updated = await bloodDonorsCollection().findOne({ _id: donor._id });
  res.json(sanitizeBloodDonor({ ...updated, isEligible: updated.nextEligibleDonationDate <= formatDateOnly(now()) }));
});

app.delete('/api/blood-drive/donors/:id', requireRole('admin'), requireBloodDriveAccess, async (req, res) => {
  const donor = await getBloodDonorById(req.params.id);

  if (!donor) {
    return res.status(404).json({ error: 'The selected blood donor record could not be found.' });
  }

  await bloodDonorsCollection().deleteOne({ _id: donor._id });
  return res.status(204).send();
});

app.get('/api/presentations/dashboard', requirePresentationsAccess, async (req, res) => {
  try {
    const dashboard = await buildPresentationDashboard(req.account, { year: req.query.year });
    res.json(dashboard);
  } catch (error) {
    console.error('Failed to load presentation dashboard.', error);
    res.status(500).json({ error: 'Failed to load presentation dashboard.' });
  }
});

app.get('/api/presentations/report', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  try {
    const report = await buildPresentationReport({ year: req.query.year });
    res.json(report);
  } catch (error) {
    console.error('Failed to load presentation report.', error);
    res.status(500).json({ error: 'Failed to load presentation report.' });
  }
});

app.post('/api/presentations/spin', requireRole('new recruit'), requirePresentationsAccess, async (req, res) => {
  const existingTopic = await presentationTopicsCollection().findOne({ assignedTo: req.account._id });

  if (existingTopic) {
    return res.status(409).json({ error: 'You already have a presentation topic.' });
  }

  const assignedAt = now();
  const topicResult = await presentationTopicsCollection().findOneAndUpdate(
    { isAssigned: false },
    {
      $set: {
        isAssigned: true,
        assignedTo: req.account._id,
        assignedAt
      }
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );

  const assignedTopic = topicResult?.value || topicResult;

  if (!assignedTopic) {
    return res.status(409).json({ error: 'No topics available.' });
  }

  res.json({ topic: sanitizePresentationTopic(assignedTopic) });
});

app.post('/api/presentations/book-slot', requireRole('new recruit'), requirePresentationsAccess, async (req, res) => {
  const { slotId } = req.body || {};
  const nextSlotId = toObjectId(slotId);

  if (!nextSlotId) {
    return res.status(400).json({ error: 'Valid slotId is required.' });
  }

  const assignedTopic = await presentationTopicsCollection().findOne({ assignedTo: req.account._id });
  if (!assignedTopic) {
    return res.status(409).json({ error: 'Select a presentation topic before booking a time.' });
  }

  const slot = await presentationSlotsCollection().findOne({ _id: nextSlotId, isActive: { $ne: false } });
  if (!slot) {
    return res.status(404).json({ error: 'Presentation slot not found.' });
  }

  const slotBooking = await presentationBookingsCollection().findOne({
    slotId: nextSlotId,
    userId: { $ne: req.account._id }
  });

  if (slotBooking) {
    return res.status(409).json({ error: 'This presentation slot is already taken.' });
  }

  const existingBooking = await presentationBookingsCollection().findOne({ userId: req.account._id });
  const bookingPayload = {
    userId: req.account._id,
    slotId: nextSlotId,
    confirmedAt: now(),
    updatedAt: now()
  };

  if (existingBooking) {
    await presentationBookingsCollection().updateOne(
      { _id: existingBooking._id },
      { $set: bookingPayload }
    );
  } else {
    await presentationBookingsCollection().insertOne({
      ...bookingPayload,
      createdAt: now()
    });
  }

  const freshBooking = await presentationBookingsCollection().findOne({ userId: req.account._id });
  res.json({
    booking: sanitizePresentationSlot(slot, freshBooking, req.account)
  });
});

app.post('/api/presentations/topics', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const { title, description, topics } = req.body || {};

  const docs = Array.isArray(topics)
    ? topics
        .map((item) => ({
          title: String(item.title || '').trim(),
          description: String(item.description || '').trim()
        }))
        .filter((item) => item.title.length >= 3)
    : [{ title: String(title || '').trim(), description: String(description || '').trim() }].filter(
        (item) => item.title.length >= 3
      );

  if (!docs.length) {
    return res.status(400).json({ error: 'At least one valid presentation topic is required.' });
  }

  try {
    const payload = docs.map((item) => ({
      ...item,
      isAssigned: false,
      assignedTo: null,
      assignedAt: null,
      createdAt: now(),
      createdByUserId: req.account._id,
      createdByName: req.account.displayName || req.account.username
    }));

    const result = await presentationTopicsCollection().insertMany(payload, { ordered: false });
    res.status(201).json({ inserted: Object.keys(result.insertedIds).length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add presentation subjects.' });
  }
});

app.delete('/api/presentations/topics/:id', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const topic = await getPresentationTopicById(req.params.id);

  if (!topic) {
    return res.status(404).json({ error: 'Presentation topic not found.' });
  }

  if (topic.isAssigned) {
    return res.status(409).json({ error: 'Assigned topics cannot be deleted.' });
  }

  await presentationTopicsCollection().deleteOne({ _id: topic._id });
  res.status(204).send();
});

app.post('/api/presentations/slots', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const { rangeStartAt, rangeEndAt, durationMinutes } = req.body || {};

  if (!rangeStartAt || !rangeEndAt || !durationMinutes) {
    return res.status(400).json({ error: 'rangeStartAt, rangeEndAt, and durationMinutes are required.' });
  }

  const startDate = new Date(rangeStartAt);
  const endDate = new Date(rangeEndAt);
  const duration = Number(durationMinutes);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return res.status(400).json({ error: 'Slot range dates are invalid.' });
  }

  if (!Number.isInteger(duration) || duration < 5) {
    return res.status(400).json({ error: 'durationMinutes must be an integer of at least 5.' });
  }

  const payload = [];
  let cursor = new Date(startDate);
  while (addMinutes(cursor, duration) <= endDate) {
    payload.push({
      startAt: new Date(cursor),
      endAt: addMinutes(cursor, duration),
      capacity: 1,
      isActive: true,
      createdAt: now(),
      createdByUserId: req.account._id
    });
    cursor = addMinutes(cursor, duration);
  }

  if (!payload.length) {
    return res.status(400).json({ error: 'The selected range is too short for the chosen duration.' });
  }

  try {
    const result = await presentationSlotsCollection().insertMany(payload, { ordered: false });
    res.status(201).json({ inserted: Object.keys(result.insertedIds || {}).length });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'One or more slots already exist in this range.' });
    }

    return res.status(500).json({ error: 'Failed to add the presentation slots.' });
  }
});

app.delete('/api/presentations/slots/:id', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const slot = await getPresentationSlotById(req.params.id);

  if (!slot) {
    return res.status(404).json({ error: 'Presentation slot not found.' });
  }

  const booking = await presentationBookingsCollection().findOne({ slotId: slot._id });
  if (booking) {
    return res.status(409).json({ error: 'Booked slots cannot be deleted.' });
  }

  await presentationSlotsCollection().deleteOne({ _id: slot._id });
  res.status(204).send();
});

app.post('/api/presentations/criteria', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const { title, description, order, isActive = true } = req.body || {};
  const nextTitle = String(title || '').trim();
  const nextDescription = String(description || '').trim();
  const nextOrder = Number(order);

  if (nextTitle.length < 2) {
    return res.status(400).json({ error: 'Criterion title is required.' });
  }

  if (!Number.isInteger(nextOrder) || nextOrder < 1) {
    return res.status(400).json({ error: 'Criterion order must be an integer greater than 0.' });
  }

  try {
    const payload = {
      title: nextTitle,
      description: nextDescription,
      order: nextOrder,
      isActive: Boolean(isActive),
      createdAt: now()
    };

    const result = await presentationCriteriaCollection().insertOne(payload);
    res.status(201).json(sanitizePresentationCriterion({ ...payload, _id: result.insertedId }));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A criterion with this order already exists.' });
    }

    return res.status(500).json({ error: 'Failed to add the presentation criterion.' });
  }
});

app.patch('/api/presentations/presenters/:presenterId/allow-second-attempt', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  try {
    const presenterId = toObjectId(req.params.presenterId);

    if (!presenterId) {
      return res.status(400).json({ error: 'Invalid presenter id.' });
    }

    const presenter = await usersCollection().findOne({ _id: presenterId, role: 'new recruit' });

    if (!presenter) {
      return res.status(404).json({ error: 'New recruit not found.' });
    }

    const allowSecondAttempt = Boolean(req.body?.allowSecondAttempt);

    await usersCollection().updateOne(
      { _id: presenterId },
      { $set: { allowPresentationAttemptTwo: allowSecondAttempt, updatedAt: now() } }
    );

    res.json({ ok: true, presenterId: String(presenterId), allowSecondAttempt });
  } catch (error) {
    console.error('Failed to update presentation second attempt.', error);
    res.status(500).json({ error: 'Failed to update presentation second attempt.' });
  }
});

app.put('/api/presentations/criteria/:id', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const criterion = await getPresentationCriterionById(req.params.id);

  if (!criterion) {
    return res.status(404).json({ error: 'Presentation criterion not found.' });
  }

  const { title, description, order, isActive } = req.body || {};
  const updates = {};

  if (typeof title === 'string' && title.trim()) {
    updates.title = title.trim();
  }

  if (typeof description === 'string') {
    updates.description = description.trim();
  }

  if (order !== undefined) {
    const nextOrder = Number(order);
    if (!Number.isInteger(nextOrder) || nextOrder < 1) {
      return res.status(400).json({ error: 'Criterion order must be an integer greater than 0.' });
    }
    updates.order = nextOrder;
  }

  if (typeof isActive === 'boolean') {
    updates.isActive = isActive;
  }

  try {
    await presentationCriteriaCollection().updateOne({ _id: criterion._id }, { $set: updates });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A criterion with this order already exists.' });
    }

    return res.status(500).json({ error: 'Failed to update the presentation criterion.' });
  }

  const updated = await presentationCriteriaCollection().findOne({ _id: criterion._id });
  res.json(sanitizePresentationCriterion(updated));
});

app.delete('/api/presentations/criteria/:id', requireRole('admin'), requirePresentationsAccess, async (req, res) => {
  const criterion = await getPresentationCriterionById(req.params.id);

  if (!criterion) {
    return res.status(404).json({ error: 'Presentation criterion not found.' });
  }

  await presentationCriteriaCollection().deleteOne({ _id: criterion._id });
  res.status(204).send();
});

app.put('/api/presentations/evaluations/:presenterId', requireRole('admin', 'member'), requirePresentationsAccess, async (req, res) => {
  try {
    const presenterId = toObjectId(req.params.presenterId);
    const { scores, comment, attempt } = req.body || {};

    if (!presenterId) {
      return res.status(400).json({ error: 'Invalid presenter id.' });
    }

    const presenter = await usersCollection().findOne({ _id: presenterId, role: 'new recruit' });

    if (!presenter) {
      return res.status(404).json({ error: 'New recruit not found.' });
    }

    const topic = await presentationTopicsCollection().findOne({ assignedTo: presenterId });
    if (!topic) {
      return res.status(409).json({ error: 'This recruit has not selected a presentation topic yet.' });
    }

    const nextAttempt = Number(attempt || 1);

    if (![1, 2].includes(nextAttempt)) {
      return res.status(400).json({ error: 'attempt must be 1 or 2.' });
    }

    if (nextAttempt === 2 && presenter.allowPresentationAttemptTwo !== true) {
      return res.status(403).json({ error: 'Second attempt is not enabled for this recruit.' });
    }

    const activeCriteria = await presentationCriteriaCollection()
      .find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    if (!activeCriteria.length) {
      return res.status(409).json({ error: 'No active grading criteria found.' });
    }

    if (!Array.isArray(scores) || scores.length !== activeCriteria.length) {
      return res.status(400).json({ error: 'Provide one score for each active criterion.' });
    }

    const criterionMap = new Map(activeCriteria.map((criterion) => [String(criterion._id), criterion]));
    const usedIds = new Set();
    const rows = [];

    for (const item of scores) {
      const criterionId = toObjectId(item.criterionId);
      if (!criterionId || !criterionMap.has(String(criterionId))) {
        return res.status(400).json({ error: 'One or more criteria are invalid.' });
      }

      if (usedIds.has(String(criterionId))) {
        return res.status(400).json({ error: 'Duplicate criterion score provided.' });
      }
      usedIds.add(String(criterionId));

      const score = Number(item.score);
      if (!Number.isInteger(score) || score < 1 || score > 10) {
        return res.status(400).json({ error: 'Scores must be integers from 1 to 10.' });
      }

      const criterion = criterionMap.get(String(criterionId));
      rows.push({
        criterionId,
        title: criterion.title,
        order: criterion.order,
        score
      });
    }

    const totalScore = calculatePresentationTotalScore(rows);
    const timestamp = now();
    const payload = {
      presenterUserId: presenterId,
      evaluatorUserId: req.account._id,
      attempt: nextAttempt,
      comment: String(comment || '').trim(),
      totalScore,
      criteria: rows.sort((a, b) => a.order - b.order),
      updatedAt: timestamp
    };

    await presentationEvaluationsCollection().updateOne(
      { presenterUserId: presenterId, evaluatorUserId: req.account._id, attempt: nextAttempt },
      {
        $set: payload,
        $setOnInsert: { createdAt: timestamp }
      },
      { upsert: true }
    );

    const evaluation = await presentationEvaluationsCollection().findOne({
      presenterUserId: presenterId,
      evaluatorUserId: req.account._id,
      attempt: nextAttempt
    });
    return res.json(sanitizePresentationEvaluation(evaluation));
  } catch (error) {
    if (error?.code === 11000 && Object.prototype.hasOwnProperty.call(error?.keyPattern || {}, 'presenterUserId')) {
      return res.status(409).json({
        error: 'A legacy presentation evaluation index is blocking per-user scoring. Restart the backend after the index cleanup runs.'
      });
    }

    console.error('Failed to save presentation evaluation.', error);
    return res.status(500).json({ error: 'Failed to save presentation evaluation.' });
  }
});

app.get('/api/settings', requireRole('admin'), async (req, res) => {
  const telegram = await readTelegramSettings();
  res.json({
    defaultChatId: telegram.defaultChatId,
    birthdayMessageTemplate: telegram.birthdayMessageTemplate,
    timezone: telegram.timezone,
    hasBotToken: Boolean(telegram.botToken)
  });
});

app.put('/api/settings', requireRole('admin'), async (req, res) => {
  const { defaultChatId } = req.body || {};
  const telegram = await readTelegramSettings();

  const updated = await writeTelegramSettings({
    ...telegram,
    defaultChatId: typeof defaultChatId === 'string' ? defaultChatId.trim() : telegram.defaultChatId
  });

  res.json({
    defaultChatId: updated.defaultChatId,
    birthdayMessageTemplate: updated.birthdayMessageTemplate,
    timezone: updated.timezone,
    hasBotToken: Boolean(updated.botToken)
  });
});

app.post('/api/birthdays/run-now', requireRole('admin'), async (req, res) => {
  try {
    const result = await runBirthdayCheck({ force: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  await connectToDatabase();

  app.listen(PORT, () => {
    startBirthdayScheduler();
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
