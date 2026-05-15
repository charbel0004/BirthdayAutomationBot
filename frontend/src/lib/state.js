export const pages = {
  home: 'home',
  adminBirthdays: 'admin-birthdays',
  adminUsers: 'admin-users',
  adminSettings: 'admin-settings',
  bloodDrive: 'blood-drive',
  eligibleDonors: 'eligible-donors',
  repository: 'repository',
  donationLocations: 'donation-locations',
  recruitment: 'recruitment',
  recruitmentRepository: 'recruitment-repository',
  recruitmentCallCenter: 'recruitment-call-center',
  recruitmentInterestPublic: 'recruitment-interest',
  presentations: 'presentations',
  quete: 'quete',
  queteBoard: 'quete-board',
  queteMembers: 'quete-members',
  queteShiftSetup: 'quete-shift-setup',
  queteReport: 'quete-report',
  queteFocals: 'quete-focals'
};

export const moduleAccessKeys = ['bloodDrive', 'recruitment', 'presentations', 'quete'];

export const moduleAccessLabels = {
  bloodDrive: 'Blood Drive',
  recruitment: 'Recruitment',
  presentations: 'Presentations',
  quete: 'Quete'
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
  presentations: pages.presentations,
  quete: pages.quete,
  'quete-board': pages.queteBoard,
  'quete-members': pages.queteMembers,
  'admin-birthdays': pages.adminBirthdays,
  'admin-users': pages.adminUsers,
  'admin-settings': pages.adminSettings,
  'quete-shift-setup': pages.queteShiftSetup,
  'quete-report': pages.queteReport,
  'quete-focals': pages.queteFocals
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
    membersGroupChatId: '',
    newRecruitsGroupChatId: '',
    timezone: 'Asia/Beirut',
    hasBotToken: false
  };
}

export function createEmptyQueteShift() {
  return {
    id: '',
    title: '',
    shiftType: 'morning',
    shiftCategory: 'road',
    date: '',
    startAt: '',
    endAt: '',
    bookingOpensOn: '',
    bookingClosesOn: '',
    capacity: 2,
    location: '',
    notes: ''
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
    moduleAccess: createDefaultModuleAccess('member'),
    isQueteFocal: false
  };
}

export function createDefaultModuleAccess(role = 'member') {
  if (role === 'admin') {
    return {
      bloodDrive: true,
      recruitment: true,
      presentations: true,
      quete: true
    };
  }

  if (role === 'new recruit') {
    return {
      bloodDrive: false,
      recruitment: false,
      presentations: true,
      quete: true
    };
  }

  return {
    bloodDrive: true,
    recruitment: true,
    presentations: true,
    quete: true
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

export function createEmptyQueteData() {
  return {
    stats: {
      totalShifts: 0,
      totalReservations: 0,
      openShifts: 0,
      totalFocals: 0,
      roadShifts: 0,
      restaurantShifts: 0,
      churchShifts: 0,
      churchMassShifts: 0,
      totalCapacity: 0,
      filledSeats: 0,
      occupancyRate: 0,
      uniqueParticipants: 0,
      adminParticipants: 0,
      memberParticipants: 0,
      recruitParticipants: 0,
      totalWeightedReservations: 0
    },
    shifts: [],
    myReservations: [],
    focals: [],
    canManage: false,
    admin: { manageableUsers: [], report: [] }
  };
}
