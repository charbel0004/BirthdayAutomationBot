export const pages = {
  home: 'home',
  bloodDrive: 'blood-drive',
  eligibleDonors: 'eligible-donors',
  repository: 'repository',
  donationLocations: 'donation-locations',
  recruitment: 'recruitment',
  recruitmentRepository: 'recruitment-repository',
  recruitmentCallCenter: 'recruitment-call-center',
  recruitmentInterestPublic: 'recruitment-interest',
  presentations: 'presentations'
};

export const moduleAccessKeys = ['bloodDrive', 'recruitment', 'presentations'];

export const moduleAccessLabels = {
  bloodDrive: 'Blood Drive',
  recruitment: 'Recruitment',
  presentations: 'Presentations'
};

const routeToPage = {
  '': pages.home,
  home: pages.home,
  'blood-drive': pages.bloodDrive,
  'eligible-donors': pages.eligibleDonors,
  repository: pages.repository,
  'donation-locations': pages.donationLocations,
  recruitment: pages.recruitment,
  'recruitment-repository': pages.recruitmentRepository,
  'recruitment-call-center': pages.recruitmentCallCenter,
  'recruitment-interest': pages.recruitmentInterestPublic,
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
    active: true,
    moduleAccess: createDefaultModuleAccess('member')
  };
}

export function createDefaultModuleAccess(role = 'member') {
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

export function normalizeModuleAccess(role = 'member', moduleAccess = {}) {
  const defaults = createDefaultModuleAccess(role);
  return moduleAccessKeys.reduce((accumulator, key) => {
    accumulator[key] = typeof moduleAccess?.[key] === 'boolean' ? moduleAccess[key] : defaults[key];
    return accumulator;
  }, {});
}

export function hasModuleAccess(user, moduleKey) {
  if (!user || !moduleKey) {
    return false;
  }

  return Boolean(normalizeModuleAccess(user.role, user.moduleAccess)[moduleKey]);
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
