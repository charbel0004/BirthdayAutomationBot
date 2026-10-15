const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const validScore = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

function examScore(exam) {
  if (!exam || !Number.isFinite(exam.maximumScore) || exam.maximumScore <= 0 || !Number.isFinite(exam.score) || exam.score < 0 || exam.score > exam.maximumScore) return null;
  return exam.score / exam.maximumScore * 100;
}

function evaluationScore(evaluation) {
  const rows = evaluation.criteria;
  if (!Array.isArray(rows) || !rows.length || (evaluation.expectedCriteriaCount && rows.length !== evaluation.expectedCriteriaCount)) return null;
  if (new Set(rows.map((row) => String(row.criterionId))).size !== rows.length) return null;
  if (rows.some((row) => !Number.isInteger(row.score) || row.score < 1 || row.score > 10)) return null;
  return rows.reduce((sum, row) => sum + row.score, 0) / (rows.length * 10) * 100;
}

function weightedPresentation(evaluations, weights = { admin: 2, member: 1 }) {
  const latest = new Map();
  for (const evaluation of evaluations) {
    const key = String(evaluation.evaluatorUserId || evaluation._id);
    const previous = latest.get(key);
    if (!previous || new Date(evaluation.updatedAt || 0) >= new Date(previous.updatedAt || 0)) latest.set(key, evaluation);
  }
  const entries = [...latest.values()].map((evaluation) => ({
    evaluation,
    score: evaluationScore(evaluation),
    weight: evaluation.evaluatorRole === 'admin' ? weights.admin : weights.member
  })).filter((entry) => entry.score !== null && Number.isFinite(entry.weight) && entry.weight > 0);
  const sumWeights = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return { score: sumWeights ? entries.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / sumWeights : null, entries };
}

function finalAssessment(exam, presentation, commitment) {
  const components = { exam: examScore(exam), presentation: validScore(presentation) ? presentation : null, commitment: validScore(commitment) ? commitment : null };
  const weights = { exam: .4, presentation: .4, commitment: .2 };
  const missing = Object.keys(components).filter((key) => components[key] === null);
  const contributions = Object.fromEntries(Object.entries(components).map(([key, score]) => [key, score === null ? null : round(score * weights[key])]));
  const total = missing.length ? null : round(Object.entries(components).reduce((sum, [key, score]) => sum + score * weights[key], 0));
  return { components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, value === null ? null : round(value)])), contributions, total, missing, status: missing.length ? 'Incomplete' : 'Complete' };
}

module.exports = { round, examScore, evaluationScore, weightedPresentation, finalAssessment };
