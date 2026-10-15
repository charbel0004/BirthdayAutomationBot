const test = require('node:test');
const assert = require('node:assert/strict');
const { weightedPresentation, finalAssessment, evaluationScore } = require('../src/assessment-scoring');
const evaluation = (id, score, role = 'member') => ({ evaluatorUserId: id, evaluatorRole: role, criteria: [{ criterionId: 'a', score }], expectedCriteriaCount: 1 });

test('Admin 90×2, GA 80×1 and 70×1 produce 82.5/100', () => {
  assert.equal(weightedPresentation([evaluation('admin', 9, 'admin'), evaluation('ga1', 8), evaluation('ga2', 7)]).score, 82.5);
});
test('Evaluator count never increases the maximum score', () => {
  assert.equal(weightedPresentation(Array.from({ length: 100 }, (_, index) => evaluation(String(index), 10))).score, 100);
});
test('Missing and partial evaluation data are excluded, duplicate authors count once', () => {
  assert.equal(evaluationScore({ criteria: [] }), null);
  assert.equal(evaluationScore({ ...evaluation('a', 9), expectedCriteriaCount: 2 }), null);
  assert.equal(weightedPresentation([evaluation('a', 8), evaluation('a', 9)]).entries.length, 1);
  assert.equal(weightedPresentation([]).score, null);
});
test('Final assessment is normalized, weighted 40/40/20, with missing distinct from zero', () => {
  assert.equal(finalAssessment({ score: 17, maximumScore: 20 }, 90, 95).total, 89);
  assert.equal(finalAssessment({ score: 0, maximumScore: 20 }, 0, 0).total, 0);
  assert.equal(finalAssessment(null, 90, 95).total, null);
  assert.equal(finalAssessment({ score: 85, maximumScore: 100 }, null, 95).status, 'Incomplete');
  assert.equal(finalAssessment({ score: 85, maximumScore: 0 }, 90, undefined).total, null);
});
test('Configured role weights affect results using the same formula', () => {
  assert.equal(weightedPresentation([evaluation('a', 10, 'admin'), evaluation('b', 6)], { admin: 3, member: 1 }).score, 90);
});
