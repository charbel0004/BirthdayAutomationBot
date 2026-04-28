export const pages = {
  home: 'home',
  bloodDrive: 'blood-drive',
  eligibleDonors: 'eligible-donors',
  repository: 'repository',
  presentations: 'presentations'
};

const routeToPage = {
  '': pages.home,
  home: pages.home,
  'blood-drive': pages.bloodDrive,
  'eligible-donors': pages.eligibleDonors,
  repository: pages.repository,
  presentations: pages.presentations
};

export function getPageFromHash(hash = window.location.hash) {
  const normalized = String(hash || '')
    .replace(/^#\/?/, '')
    .trim()
    .toLowerCase();

  return routeToPage[normalized] || pages.home;
}

export function getHashForPage(page) {
  if (!page || page === pages.home) {
    return '#/';
  }

  return `#/${page}`;
}

export function createDefaultSettings() {
  return {
    defaultChatId: '',
    timezone: 'Asia/Beirut',
    hasBotToken: false
  };
}

export function createEmptyBirthday() {
  return {
    userId: '',
    name: '',
    birthdate: '',
    active: true
  };
}

export function createEmptyUser() {
  return {
    username: '',
    displayName: '',
    password: '',
    role: 'member',
    active: true
  };
}

export function createEmptyDonorStats() {
  return {
    totals: { total: 0, eligible: 0, upcoming: 0 },
    byLocation: [],
    byAgeGroup: []
  };
}

export function createEmptyPresentationData(year) {
  return {
    stats: {
      totalTopics: 0,
      availableTopics: 0,
      assignedTopics: 0,
      totalSlots: 0,
      openSlots: 0,
      bookedPresentations: 0,
      evaluatedPresentations: 0,
      averageScore: 0
    },
    selectedYear: year,
    availableYears: [year],
    presenters: [],
    activeCriteria: [],
    recruit: null,
    admin: { topics: [], slots: [], criteria: [], evaluations: [] }
  };
}

export function createEmptyPresentationReport() {
  return { rankings: [] };
}
