const {
  logisticsActivitiesCollection,
  logisticsItemsCollection,
  logisticsMovementsCollection,
  normalizeName,
  now,
  toObjectId,
  withTransaction
} = require('./db');

const INVENTORY_SCOPES = [
  { id: 'center', name: 'Center Logistics', kind: 'center' },
  { id: 'program-1', name: 'HVP', kind: 'program' },
  { id: 'program-2', name: 'Youth and Health', kind: 'program' },
  { id: 'program-3', name: 'Environment', kind: 'program' }
];
const SCOPE_IDS = new Set(INVENTORY_SCOPES.map((scope) => scope.id));
const PERMISSIONS = ['view', 'manageInventory', 'manageActivities', 'recordMovements', 'viewReports'];
const MOVEMENT_TYPES = new Set(['restock', 'borrow', 'return', 'consume', 'loss', 'damage', 'adjustment']);

function createDefaultLogisticsAccess(role = 'member', moduleEnabled = false) {
  if (role === 'admin') return { full: true, scopes: INVENTORY_SCOPES.map(({ id }) => id), permissions: Object.fromEntries(PERMISSIONS.map((key) => [key, true])) };
  return {
    full: false,
    scopes: moduleEnabled ? ['center'] : [],
    permissions: Object.fromEntries(PERMISSIONS.map((key) => [key, Boolean(moduleEnabled)]))
  };
}

function normalizeLogisticsAccess(role, moduleEnabled, access = {}) {
  if (role === 'admin') return createDefaultLogisticsAccess('admin', true);
  const defaults = createDefaultLogisticsAccess(role, moduleEnabled);
  const full = access?.full === true;
  const scopes = [...new Set((Array.isArray(access?.scopes) ? access.scopes : defaults.scopes).filter((scope) => SCOPE_IDS.has(scope)))];
  const permissions = Object.fromEntries(PERMISSIONS.map((key) => [key, full || (typeof access?.permissions?.[key] === 'boolean' ? access.permissions[key] : defaults.permissions[key])]));
  // Any operational permission necessarily needs read access to the same workspace.
  // This prevents accounts that can technically mutate stock but cannot load the page.
  if (PERMISSIONS.some((key) => key !== 'view' && permissions[key])) permissions.view = true;
  return { full, scopes: full ? INVENTORY_SCOPES.map(({ id }) => id) : scopes, permissions };
}

function can(account, permission, scope) {
  if (account?.role === 'admin') return true;
  const enabled = account?.moduleAccess?.logistics === true;
  const access = normalizeLogisticsAccess(account?.role, enabled, account?.logisticsAccess);
  return enabled && access.permissions[permission] === true && (!scope || access.scopes.includes(scope));
}

function allowedScopes(account) {
  if (account?.role === 'admin') return INVENTORY_SCOPES.map(({ id }) => id);
  return normalizeLogisticsAccess(account?.role, account?.moduleAccess?.logistics === true, account?.logisticsAccess).scopes;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function number(value, label, { allowNegative = false } = {}) {
  const result = Number(value);
  if (!Number.isFinite(result) || (!allowNegative && result <= 0) || (allowNegative && result === 0)) {
    throw httpError(400, `${label} must be ${allowNegative ? 'a non-zero number' : 'greater than zero'}.`);
  }
  return result;
}

function dateOnly(value, label) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) throw httpError(400, `Please enter a valid ${label}.`);
  return text;
}

function movementDeltas(type, quantity) {
  if (type === 'restock') return { quantity };
  if (type === 'borrow') return { quantity: -quantity, borrowedQuantity: quantity };
  if (type === 'return') return { quantity, borrowedQuantity: -quantity };
  if (type === 'consume') return { quantity: -quantity, consumedQuantity: quantity };
  if (type === 'loss') return { borrowedQuantity: -quantity, lostQuantity: quantity };
  if (type === 'damage') return { borrowedQuantity: -quantity, damagedQuantity: quantity };
  if (type === 'adjustment') return { quantity };
  throw httpError(400, 'Please choose a valid stock action.');
}

function isItemAllowedForActivity(itemScope, activityScope) {
  return activityScope !== 'center' && (itemScope === 'center' || itemScope === activityScope);
}

function normalizeMovementQuantity(item, rawQuantity, quantityMode = 'unit') {
  if (!['unit', 'package'].includes(quantityMode)) throw httpError(400, 'Quantity must be entered as packages or base units.');
  if (quantityMode === 'package' && (!item.packageUnit || !Number(item.unitsPerPackage))) throw httpError(400, 'This item is not configured for package quantities.');
  return quantityMode === 'package' ? rawQuantity * Number(item.unitsPerPackage) : rawQuantity;
}

function sanitizeItem(item) {
  const available = Number(item.quantity || 0);
  const borrowed = Number(item.borrowedQuantity || 0);
  const ownedUsable = (item.itemType || 'reusable') === 'reusable' ? available + borrowed : available;
  const unitsPerPackage = item.unitsPerPackage ? Number(item.unitsPerPackage) : null;
  const fullPackageEquivalent = unitsPerPackage ? Math.floor(available / unitsPerPackage) : null;
  const looseUnitEquivalent = unitsPerPackage ? Number((available - fullPackageEquivalent * unitsPerPackage).toFixed(6)) : null;
  const suggestedOrder = Math.max(0, Number(item.targetStock ?? item.reorderPoint ?? 0) - ownedUsable);
  return {
    id: String(item._id), name: item.name, category: item.category, scope: item.scope || 'center',
    itemType: item.itemType || 'reusable', totalQuantity: available + borrowed,
    availableQuantity: available, quantity: available, borrowedQuantity: borrowed,
    consumedQuantity: Number(item.consumedQuantity || 0), lostQuantity: Number(item.lostQuantity || 0),
    damagedQuantity: Number(item.damagedQuantity || 0), unit: item.unit || 'units',
    packageUnit: item.packageUnit || '', unitsPerPackage,
    fullPackageEquivalent, looseUnitEquivalent,
    reorderPoint: Number(item.reorderPoint || 0), targetStock: item.targetStock == null ? null : Number(item.targetStock),
    suggestedOrder,
    suggestedPackages: unitsPerPackage ? Math.ceil(suggestedOrder / unitsPerPackage) : null,
    location: item.location || '', notes: item.notes || '', active: item.active !== false,
    isLowStock: item.active !== false && ownedUsable <= Number(item.reorderPoint || 0),
    stockStatus: available <= 0 ? 'out-of-stock' : ownedUsable <= Number(item.reorderPoint || 0) ? 'low-stock' : 'available',
    createdAt: item.createdAt || null, updatedAt: item.updatedAt || null
  };
}

function sanitizeActivity(activity) {
  const days = [];
  const cursor = new Date(`${activity.startDate}T00:00:00Z`);
  const end = new Date(`${activity.endDate}T00:00:00Z`);
  while (cursor <= end && days.length < 366) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { id: String(activity._id), name: activity.name, scope: activity.scope, description: activity.description || '', startDate: activity.startDate, endDate: activity.endDate, responsiblePerson: activity.responsiblePerson, days, createdAt: activity.createdAt };
}

function sanitizeMovement(entry) {
  return {
    id: String(entry._id), itemId: String(entry.itemId), itemName: entry.itemName, scope: entry.scope,
    type: entry.type, quantity: Number(entry.quantity), quantityMode: entry.quantityMode || 'unit', enteredQuantity: Number(entry.enteredQuantity ?? entry.quantity), activityId: entry.activityId ? String(entry.activityId) : null,
    activityName: entry.activityName || '', activityDate: entry.activityDate || '', purpose: entry.purpose || '',
    notes: entry.notes || '', responsibleUserId: String(entry.responsibleUserId), responsibleUserName: entry.responsibleUserName,
    createdAt: entry.createdAt
  };
}

async function createActivity(account, input) {
  const scope = String(input.scope || '');
  if (scope === 'center' || !SCOPE_IDS.has(scope)) throw httpError(400, 'Activities must belong to one of the three programs.');
  if (!can(account, 'manageActivities', scope)) throw httpError(403, 'You cannot manage activities for this program.');
  const name = String(input.name || '').trim();
  const startDate = dateOnly(input.startDate, 'start date');
  const endDate = dateOnly(input.endDate, 'end date');
  if (!name) throw httpError(400, 'Please enter an activity name.');
  if (endDate < startDate) throw httpError(400, 'The end date cannot be before the start date.');
  const doc = { name, normalizedName: normalizeName(name), scope, description: String(input.description || '').trim(), startDate, endDate, responsiblePerson: String(input.responsiblePerson || account.displayName || account.username).trim(), createdBy: account._id, createdAt: now(), updatedAt: now() };
  try {
    const result = await logisticsActivitiesCollection().insertOne(doc);
    return sanitizeActivity({ ...doc, _id: result.insertedId });
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, 'An activity with this name and start date already exists in this program.');
    throw error;
  }
}

async function calculateOutstanding(itemId, activityId, activityDate, session) {
  const match = { itemId, activityId };
  if (activityDate) match.activityDate = activityDate;
  const [row] = await logisticsMovementsCollection().aggregate([
    { $match: match },
    { $group: { _id: null, borrowed: { $sum: { $cond: [{ $eq: ['$type', 'borrow'] }, '$quantity', 0] } }, resolved: { $sum: { $cond: [{ $in: ['$type', ['return', 'loss', 'damage']] }, '$quantity', 0] } } } }
  ], { session }).toArray();
  return Number(row?.borrowed || 0) - Number(row?.resolved || 0);
}

async function processMovement(account, input) {
  const type = String(input.type || '').trim();
  const itemId = toObjectId(input.itemId);
  if (!MOVEMENT_TYPES.has(type)) throw httpError(400, 'Please choose a valid stock action.');
  if (!itemId) throw httpError(400, 'Please choose an inventory item.');
  const rawQuantity = number(input.quantity, 'Quantity', { allowNegative: type === 'adjustment' });
  const idempotencyKey = String(input.idempotencyKey || '').trim() || undefined;

  try {
    return await withTransaction(async (session) => {
      if (idempotencyKey) {
        const existing = await logisticsMovementsCollection().findOne({ idempotencyKey }, { session });
        if (existing) return sanitizeMovement(existing);
      }
      const item = await logisticsItemsCollection().findOne({ _id: itemId, active: { $ne: false } }, { session });
      if (!item) throw httpError(404, 'The selected inventory item could not be found.');
      const scope = item.scope || 'center';
      const permission = type === 'restock' || type === 'adjustment' ? 'manageInventory' : 'recordMovements';
      const quantityMode = String(input.quantityMode || 'unit');
      const quantity = normalizeMovementQuantity(item, rawQuantity, quantityMode);
      const isActivityRequired = scope !== 'center' && ['borrow', 'return', 'consume', 'loss', 'damage'].includes(type);
      let activity = null;
      let activityId = null;
      let activityDate = '';
      if (input.activityId) {
        activityId = toObjectId(input.activityId);
        activity = activityId ? await logisticsActivitiesCollection().findOne({ _id: activityId }, { session }) : null;
        if (!activity || !isItemAllowedForActivity(scope, activity.scope)) throw httpError(400, 'Activities can only use Center stock or stock owned by their program.');
        if (!can(account, 'recordMovements', activity.scope)) throw httpError(403, 'You cannot record movements for this activity.');
        activityDate = dateOnly(input.activityDate, 'activity day');
        if (activityDate < activity.startDate || activityDate > activity.endDate) throw httpError(400, 'The activity day must be within the activity dates.');
      } else if (isActivityRequired) throw httpError(400, 'Program stock movements must reference an activity and activity day.');
      if (!activity && !can(account, permission, scope)) throw httpError(403, 'You do not have permission to record this stock movement.');
      const purpose = String(input.purpose || '').trim();
      if (scope === 'center' && !activity && ['borrow', 'consume'].includes(type) && !purpose) throw httpError(400, 'Please enter the purpose of this Center withdrawal.');
      if (type === 'borrow' && item.itemType === 'consumable') throw httpError(400, 'Consumable items must be recorded as consumption, not borrowing.');
      if (type === 'consume' && item.itemType !== 'consumable') throw httpError(400, 'Reusable items must be borrowed and later returned or resolved.');
      if (type === 'return' && item.itemType === 'consumable') throw httpError(400, 'Consumable items cannot be returned.');
      const notes = String(input.notes || '').trim();
      if (['loss', 'damage', 'adjustment'].includes(type) && !notes) throw httpError(400, 'Please enter a reason for this stock change.');

      if (['return', 'loss', 'damage'].includes(type)) {
        const outstanding = activityId
          ? await calculateOutstanding(itemId, activityId, '', session)
          : Number(item.borrowedQuantity || 0);
        if (quantity > outstanding) throw httpError(409, `Only ${outstanding} ${item.unit || 'units'} are outstanding for this selection.`);
      }

      const increments = movementDeltas(type, quantity);
      const requiresAvailable = ['borrow', 'consume'].includes(type) || (type === 'adjustment' && quantity < 0);
      const filter = { _id: itemId };
      if (requiresAvailable) filter.quantity = { $gte: Math.abs(quantity) };
      if (['return', 'loss', 'damage'].includes(type)) filter.borrowedQuantity = { $gte: quantity };
      const updated = await logisticsItemsCollection().findOneAndUpdate(filter, { $inc: increments, $set: { updatedAt: now() } }, { session, returnDocument: 'after' });
      if (!updated) throw httpError(409, 'There is not enough available or outstanding stock for this action. Refresh and try again.');
      const movement = { itemId, itemName: item.name, scope, type, quantity, quantityMode, enteredQuantity: rawQuantity, activityId, activityName: activity?.name || '', activityDate, purpose, notes, responsibleUserId: account._id, responsibleUserName: account.displayName || account.username, createdAt: now(), ...(idempotencyKey ? { idempotencyKey } : {}) };
      const result = await logisticsMovementsCollection().insertOne(movement, { session });
      return sanitizeMovement({ ...movement, _id: result.insertedId });
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing = await logisticsMovementsCollection().findOne({ idempotencyKey });
      if (existing) return sanitizeMovement(existing);
    }
    throw error;
  }
}

async function dashboard(account, requestedScope = '') {
  const scopes = allowedScopes(account);
  const scope = requestedScope && scopes.includes(requestedScope) ? requestedScope : '';
  const selectedScopes = scope ? [scope] : scopes;
  const programScopes = selectedScopes.filter((id) => id !== 'center');
  const sharesCenterForActivities = programScopes.some((id) => can(account, 'recordMovements', id));
  const itemScopes = [...new Set([...selectedScopes, ...(sharesCenterForActivities ? ['center'] : [])])];
  const activities = await logisticsActivitiesCollection().find({ scope: { $in: programScopes } }).sort({ startDate: -1 }).limit(100).toArray();
  const activityIds = activities.map((entry) => entry._id);
  const movementQuery = activityIds.length
    ? { $or: [{ scope: { $in: selectedScopes } }, { scope: 'center', activityId: { $in: activityIds } }] }
    : { scope: { $in: selectedScopes } };
  const [items, movements] = await Promise.all([
    logisticsItemsCollection().find({ scope: { $in: itemScopes } }).sort({ scope: 1, name: 1 }).toArray(),
    logisticsMovementsCollection().find(movementQuery).sort({ createdAt: -1 }).limit(250).toArray()
  ]);
  const activityStats = activityIds.length ? await logisticsMovementsCollection().aggregate([
    { $match: { activityId: { $in: activityIds } } },
    { $group: {
      _id: { activityId: '$activityId', itemId: '$itemId' },
      borrowed: { $sum: { $cond: [{ $eq: ['$type', 'borrow'] }, '$quantity', 0] } },
      resolved: { $sum: { $cond: [{ $in: ['$type', ['return', 'loss', 'damage']] }, '$quantity', 0] } }
    } },
    { $group: {
      _id: '$_id.activityId',
      itemIds: { $addToSet: '$_id.itemId' },
      borrowed: { $sum: '$borrowed' },
      resolved: { $sum: '$resolved' },
      outstandingItemCount: { $sum: { $cond: [{ $gt: [{ $subtract: ['$borrowed', '$resolved'] }, 0] }, 1, 0] } }
    } }
  ]).toArray() : [];
  const statsByActivity = new Map(activityStats.map((entry) => [String(entry._id), entry]));
  const sanitizedItems = items.map(sanitizeItem);
  return {
    scopes: INVENTORY_SCOPES.filter(({ id }) => itemScopes.includes(id)),
    permissions: normalizeLogisticsAccess(account.role, account.moduleAccess?.logistics === true, account.logisticsAccess),
    items: sanitizedItems,
    activities: activities.map((entry) => {
      const clean = sanitizeActivity(entry);
      const stats = statsByActivity.get(String(entry._id));
      const outstandingQuantity = Math.max(0, Number(stats?.borrowed || 0) - Number(stats?.resolved || 0));
      const today = new Date().toISOString().slice(0, 10);
      return { ...clean, itemCount: stats?.itemIds?.length || 0, outstandingItemCount: Number(stats?.outstandingItemCount || 0), borrowedQuantity: Number(stats?.borrowed || 0), outstandingQuantity, status: outstandingQuantity > 0 ? 'outstanding' : today < entry.startDate ? 'upcoming' : today > entry.endDate ? 'complete' : 'active' };
    }),
    movements: movements.map(sanitizeMovement),
    summary: {
      itemCount: sanitizedItems.length,
      available: sanitizedItems.reduce((sum, item) => sum + item.availableQuantity, 0),
      borrowed: sanitizedItems.reduce((sum, item) => sum + item.borrowedQuantity, 0),
      lowStock: sanitizedItems.filter((item) => item.isLowStock).length
    },
    scopeSummaries: INVENTORY_SCOPES.filter(({ id }) => itemScopes.includes(id)).map((inventoryScope) => {
      const scopedItems = sanitizedItems.filter((item) => item.scope === inventoryScope.id);
      return { ...inventoryScope, itemCount: scopedItems.length, borrowed: scopedItems.reduce((sum, item) => sum + item.borrowedQuantity, 0), lowStock: scopedItems.filter((item) => item.isLowStock).length, activeActivities: activities.filter((entry) => entry.scope === inventoryScope.id && entry.endDate >= new Date().toISOString().slice(0, 10)).length };
    })
  };
}

module.exports = {
  INVENTORY_SCOPES, MOVEMENT_TYPES, PERMISSIONS, allowedScopes, can, createActivity,
  createDefaultLogisticsAccess, dashboard, normalizeLogisticsAccess, processMovement,
  isItemAllowedForActivity, movementDeltas, normalizeMovementQuantity, sanitizeActivity, sanitizeItem, sanitizeMovement
};
