const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  allowedScopes,
  can,
  createDefaultLogisticsAccess,
  isItemAllowedForActivity,
  movementDeltas,
  normalizeMovementQuantity,
  normalizeLogisticsAccess,
  sanitizeItem
} = require('../src/logistics');

test('Logistics permissions are scoped and admins always receive full access', () => {
  const member = {
    role: 'member',
    moduleAccess: { logistics: true },
    logisticsAccess: {
      scopes: ['program-1'],
      permissions: { view: true, manageActivities: true, manageInventory: false, recordMovements: false, viewReports: false }
    }
  };
  assert.deepEqual(allowedScopes(member), ['program-1']);
  assert.equal(can(member, 'manageActivities', 'program-1'), true);
  assert.equal(can(member, 'manageActivities', 'program-2'), false);
  assert.equal(can(member, 'manageInventory', 'program-1'), false);
  assert.equal(can(member, 'recordMovements', 'program-1'), false);
  assert.equal(createDefaultLogisticsAccess('member', false).scopes.length, 0);
  assert.equal(normalizeLogisticsAccess('admin', true, {}).full, true);
});

test('All stock actions use one consistent balance calculation', () => {
  const reusable = { quantity: 10, borrowedQuantity: 0, lostQuantity: 0, damagedQuantity: 0 };
  const apply = (state, type, quantity) => {
    for (const [field, delta] of Object.entries(movementDeltas(type, quantity))) state[field] = Number(state[field] || 0) + delta;
  };
  apply(reusable, 'borrow', 6);
  assert.deepEqual(reusable, { quantity: 4, borrowedQuantity: 6, lostQuantity: 0, damagedQuantity: 0 });
  apply(reusable, 'return', 5);
  apply(reusable, 'loss', 1);
  assert.deepEqual(reusable, { quantity: 9, borrowedQuantity: 0, lostQuantity: 1, damagedQuantity: 0 });
  apply(reusable, 'restock', 3);
  apply(reusable, 'adjustment', -2);
  assert.equal(reusable.quantity, 10);

  const consumable = { quantity: 5, consumedQuantity: 0 };
  apply(consumable, 'consume', 5);
  assert.deepEqual(consumable, { quantity: 0, consumedQuantity: 5 });
});

test('Activities combine Center stock only with their own program stock', () => {
  assert.equal(isItemAllowedForActivity('center', 'program-1'), true);
  assert.equal(isItemAllowedForActivity('program-1', 'program-1'), true);
  assert.equal(isItemAllowedForActivity('program-2', 'program-1'), false);
  assert.equal(isItemAllowedForActivity('center', 'center'), false);
});

test('Package movements normalize to base units and report package equivalents', () => {
  const configured = { packageUnit: 'box', unitsPerPackage: 24 };
  assert.equal(normalizeMovementQuantity(configured, 3, 'package'), 72);
  assert.equal(normalizeMovementQuantity(configured, 5, 'unit'), 5);
  assert.throws(() => normalizeMovementQuantity({}, 1, 'package'), /not configured/);
  const item = sanitizeItem({ _id: new ObjectId(), name: 'Toilet paper', scope: 'center', itemType: 'consumable', quantity: 118, borrowedQuantity: 0, reorderPoint: 120, packageUnit: 'box', unitsPerPackage: 24, unit: 'roll', active: true });
  assert.equal(item.fullPackageEquivalent, 4);
  assert.equal(item.looseUnitEquivalent, 22);
  assert.equal(item.suggestedPackages, 1);
});

test('Inventory summaries keep borrowed stock separate from reorder calculations', () => {
  const item = sanitizeItem({
    _id: new ObjectId(), name: 'Scissors', scope: 'program-2', category: 'activities',
    itemType: 'reusable', quantity: 4, borrowedQuantity: 6, consumedQuantity: 0,
    lostQuantity: 1, damagedQuantity: 2, reorderPoint: 5, targetStock: 12, unit: 'pieces', active: true
  });
  assert.equal(item.availableQuantity, 4);
  assert.equal(item.borrowedQuantity, 6);
  assert.equal(item.totalQuantity, 10);
  assert.equal(item.isLowStock, false);
  assert.equal(item.suggestedOrder, 2);
});
