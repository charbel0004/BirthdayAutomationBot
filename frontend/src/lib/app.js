export const tokenKey = 'central_website_token';

const productionApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

function resolveApiUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${productionApiBaseUrl}${path}`;
}

export const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

export const monthMaxDays = {
  '01': 31,
  '02': 29,
  '03': 31,
  '04': 30,
  '05': 31,
  '06': 30,
  '07': 31,
  '08': 31,
  '09': 30,
  '10': 31,
  '11': 30,
  '12': 31
};

export const emptyBloodDriveForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  phoneNumber: '',
  location: '',
  notes: ''
};

export const emptyDonationLocation = {
  name: '',
  active: true
};

export const emptyRecruitmentInterestForm = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  dateOfBirth: ''
};

export const emptyPresentationTopic = {
  title: '',
  description: ''
};

export const emptyPresentationSlot = {
  rangeStartAt: '',
  rangeEndAt: '',
  durationMinutes: 10
};

export const emptyPresentationCriterion = {
  title: '',
  description: '',
  order: 1,
  isActive: true
};

export const emptyPresentationScoreForm = {
  presenterId: '',
  attempt: 1,
  scores: {},
  comment: ''
};

const sessionExpiryErrors = new Set([
  'Unauthorized',
  'Invalid token',
  'User no longer has access'
]);

export async function api(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const requestUrl = resolveApiUrl(path);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || `Request failed with status ${response.status}`;
    const shouldExpireSession = Boolean(
      token && (
        response.status === 401 ||
        (response.status === 403 && sessionExpiryErrors.has(message)) ||
        sessionExpiryErrors.has(message)
      )
    );

    if (shouldExpireSession) {
      localStorage.removeItem(tokenKey);
      window.dispatchEvent(new CustomEvent('app:session-expired', { detail: { message } }));
      window.location.reload();
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function downloadFile(path, { token, filename = 'download' } = {}) {
  const headers = {};
  const requestUrl = resolveApiUrl(path);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(requestUrl, { headers });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function splitBirthdate(value) {
  if (!value || !value.includes('-')) {
    return { month: '', day: '' };
  }

  const [month, day] = value.split('-');
  return { month, day };
}

export function formatBirthdayForDisplay(value) {
  const { month, day } = splitBirthdate(value);
  const monthLabel = months.find((item) => item.value === month)?.label;

  if (!monthLabel || !day) {
    return value || 'N/A';
  }

  return `${monthLabel} ${Number(day)}`;
}

export function getDaysUntilBirthday(value) {
  const { month, day } = splitBirthdate(value);

  if (!month || !day) {
    return null;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  let nextBirthday = new Date(currentYear, Number(month) - 1, Number(day));

  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, Number(month) - 1, Number(day));
  }

  const diffMs = nextBirthday.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  try {
    return new Date(value).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return value;
  }
}

export function formatCompactDate(value) {
  if (!value) return '—';

  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  }

  return normalized;
}

export function addMinutesToDateTimeLocal(value, minutes) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  date.setMinutes(date.getMinutes() + minutes);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function getNextCriterionOrder(criteria = []) {
  const orders = criteria
    .map((criterion) => Number(criterion.order))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);

  let next = 1;
  for (const order of orders) {
    if (order === next) next += 1;
    else if (order > next) break;
  }

  return next;
}

export function getMyEvaluationForAttempt(presenter, attempt) {
  return presenter?.myEvaluations?.find((item) => Number(item.attempt) === Number(attempt)) || null;
}

export function isAttemptScoredByCurrentUser(presenter, attempt) {
  return Boolean(getMyEvaluationForAttempt(presenter, attempt));
}

export function buildScoreDraft(criteria, savedEvaluation = null) {
  const nextScores = {};
  criteria.forEach((criterion) => {
    const saved = savedEvaluation?.criteria?.find((item) => item.criterionId === criterion.id);
    nextScores[criterion.id] = Number(saved?.score || 1);
  });

  return {
    scores: nextScores,
    comment: savedEvaluation?.comment || ''
  };
}

export function calculatePresentationTotalScore(scores, criteria) {
  if (!criteria.length) return 0;
  const rawTotal = scores.reduce((sum, item) => sum + (item.score || 0), 0);
  const maxTotal = criteria.length * 10;
  return Number(((rawTotal / maxTotal) * 100).toFixed(2));
}

export function getEvaluationTotalScore(evaluation) {
  if (Array.isArray(evaluation?.criteria) && evaluation.criteria.length) {
    return calculatePresentationTotalScore(
      evaluation.criteria.map((item) => ({ score: item.score || 0 })),
      evaluation.criteria
    );
  }

  return Number(evaluation?.totalScore || 0);
}
