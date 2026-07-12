import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  api,
  calculatePresentationTotalScore,
  downloadFile,
  emptyBloodDonorInterestForm,
  emptyBloodDriveForm,
  emptyDonationLocation,
  emptyQueteFocalDraft,
  emptyRecruitmentInterestForm,
  emptyPresentationCriterion,
  emptyPresentationScoreForm,
  emptyPresentationSlot,
  emptyPresentationTopic,
  getCurrentYear,
  getEvaluationTotalScore,
  getNextCriterionOrder,
  tokenKey
} from './lib/app';
import {
  createDefaultSettings,
  createEmptyBirthday,
  createEmptyDonorStats,
  createEmptyQueteData,
  createEmptyQueteShift,
  createEmptyPresentationData,
  createEmptyPresentationReport,
  createEmptyUser,
  hasModuleAccess,
  getHashForPage,
  getPageFromHash,
  pages
} from './lib/state';
import {
  AppLoader,
  BloodDonorInterestPage,
  BirthdayOverlay,
  BloodDriveOverlay,
  LoginPage,
  RecruitmentInterestPage
} from './components/common';

const HomePage = lazy(() => import('./pages/HomePage'));
const BloodDriveRouter = lazy(() => import('./pages/BloodDriveRouter'));
const RecruitmentRouter = lazy(() => import('./pages/RecruitmentRouter'));
const PresentationRouter = lazy(() => import('./pages/PresentationRouter'));
const QueteRouter = lazy(() => import('./pages/QueteRouter'));
const CertificateGeneratorPage = lazy(() => import('./pages/CertificateGeneratorPage'));

const breadcrumbConfig = {
  [pages.home]: { label: 'Home' },
  [pages.adminBirthdays]: { label: 'Birthday Records', parent: pages.home },
  [pages.adminUsers]: { label: 'Users & Roles', parent: pages.home },
  [pages.adminSettings]: { label: 'Telegram Settings', parent: pages.home },
  [pages.bloodDrive]: { label: 'Blood Drive', parent: pages.home },
  [pages.eligibleDonors]: { label: 'Eligible Donors', parent: pages.bloodDrive },
  [pages.repository]: { label: 'Donor Records', parent: pages.bloodDrive },
  [pages.donationLocations]: { label: 'Donation Locations', parent: pages.bloodDrive },
  [pages.recruitment]: { label: 'Recruitment', parent: pages.home },
  [pages.recruitmentRepository]: { label: 'Interested People', parent: pages.recruitment },
  [pages.recruitmentCallCenter]: { label: 'Call Center', parent: pages.recruitment },
  [pages.presentations]: { label: 'Presentations', parent: pages.home },
  [pages.quete]: { label: 'Quete', parent: pages.home },
  [pages.queteBoard]: { label: 'Shift Board', parent: pages.quete },
  [pages.queteMembers]: { label: 'Members', parent: pages.quete },
  [pages.queteShiftSetup]: { label: 'Shift Setup', parent: pages.quete },
  [pages.queteReport]: { label: 'Reports', parent: pages.quete },
  [pages.queteFocals]: { label: 'Focals', parent: pages.quete },
  [pages.certificateGenerator]: { label: 'Certificate Generator', parent: pages.home }
};

export default function App() {
  const bloodDriveRefreshMs = 20000;
  const emptyRepositoryDonor = { firstName: '', lastName: '', dateOfBirth: '', phoneNumber: '', notes: '' };
  const [token, setToken] = useState(localStorage.getItem(tokenKey) || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(() => getPageFromHash());
  const [me, setMe] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(createDefaultSettings);
  const [newBirthday, setNewBirthday] = useState(createEmptyBirthday);
  const [newUser, setNewUser] = useState(createEmptyUser);
  const [birthdayOverlayOpen, setBirthdayOverlayOpen] = useState(false);
  const [memberBirthdayDraft, setMemberBirthdayDraft] = useState('');
  const [memberBirthdaySaving, setMemberBirthdaySaving] = useState(false);
  const [memberBirthdayError, setMemberBirthdayError] = useState('');
  const [bloodDriveOverlayOpen, setBloodDriveOverlayOpen] = useState(false);
  const [bloodDriveSaving, setBloodDriveSaving] = useState(false);
  const [bloodDriveError, setBloodDriveError] = useState('');
  const [bloodDriveForm, setBloodDriveForm] = useState(emptyBloodDriveForm);
  const [bloodDonorInterestForm, setBloodDonorInterestForm] = useState(emptyBloodDonorInterestForm);
  const [bloodDonorInterestSaving, setBloodDonorInterestSaving] = useState(false);
  const [bloodDonorInterestCheckingDuplicate, setBloodDonorInterestCheckingDuplicate] = useState(false);
  const [bloodDonorInterestError, setBloodDonorInterestError] = useState('');
  const [bloodDonorInterestSuccess, setBloodDonorInterestSuccess] = useState('');
  const [collectionLookupQuery, setCollectionLookupQuery] = useState('');
  const [collectionLookupResults, setCollectionLookupResults] = useState([]);
  const [selectedCollectionDonor, setSelectedCollectionDonor] = useState(null);
  const [donorFilters, setDonorFilters] = useState({ name: '', location: '' });
  const [eligibleDonors, setEligibleDonors] = useState([]);
  const [allDonors, setAllDonors] = useState([]);
  const [repositoryFilters, setRepositoryFilters] = useState({ name: '', location: '' });
  const [repositoryDonorDraft, setRepositoryDonorDraft] = useState(emptyRepositoryDonor);
  const [repositoryDonorError, setRepositoryDonorError] = useState('');
  const [donationLocationDraft, setDonationLocationDraft] = useState(emptyDonationLocation);
  const [recruitmentLeadForm, setRecruitmentLeadForm] = useState(emptyRecruitmentInterestForm);
  const [recruitmentLeadSaving, setRecruitmentLeadSaving] = useState(false);
  const [recruitmentLeadError, setRecruitmentLeadError] = useState('');
  const [recruitmentLeadSuccess, setRecruitmentLeadSuccess] = useState('');
  const [recruitmentLeadDraft, setRecruitmentLeadDraft] = useState(emptyRecruitmentInterestForm);
  const [recruitmentLeadCreateSaving, setRecruitmentLeadCreateSaving] = useState(false);
  const [recruitmentLeadCreateError, setRecruitmentLeadCreateError] = useState('');
  const [recruitmentFilters, setRecruitmentFilters] = useState({ name: '', status: '' });
  const [recruitmentLeads, setRecruitmentLeads] = useState([]);
  const [donorStats, setDonorStats] = useState(createEmptyDonorStats);
  const [donationLocations, setDonationLocations] = useState([]);
  const [presentationData, setPresentationData] = useState(() => createEmptyPresentationData(getCurrentYear()));
  const [presentationReport, setPresentationReport] = useState(createEmptyPresentationReport);
  const [queteData, setQueteData] = useState(createEmptyQueteData);
  const [queteShiftDraft, setQueteShiftDraft] = useState(createEmptyQueteShift);
  const [queteAssignmentDraft, setQueteAssignmentDraft] = useState({});
  const [queteFocalDraft, setQueteFocalDraft] = useState(emptyQueteFocalDraft);
  const [presentationYear, setPresentationYear] = useState(getCurrentYear());
  const [presentationTopicDraft, setPresentationTopicDraft] = useState(emptyPresentationTopic);
  const [presentationSlotDraft, setPresentationSlotDraft] = useState(emptyPresentationSlot);
  const [presentationCriterionDraft, setPresentationCriterionDraft] = useState(emptyPresentationCriterion);
  const [presentationScoreDraft, setPresentationScoreDraft] = useState(emptyPresentationScoreForm);
  const [presentationScoreOverlayOpen, setPresentationScoreOverlayOpen] = useState(false);
  const [presentationSpinning, setPresentationSpinning] = useState(false);
  const bloodDonorDuplicateCheckIdRef = useRef(0);

  const showNotice = (message) => {
    setError('');
    setNotice(message);
    window.clearTimeout(showNotice.timeoutId);
    showNotice.timeoutId = window.setTimeout(() => setNotice(''), 2800);
  };

  const formatBirthdayRunMessage = (matched = []) => {
    if (!matched.length) {
      return 'Birthday check completed. No birthdays were scheduled for today.';
    }

    const names = matched.map((item) => item.name).join(', ');
    return `Birthday check completed. Today's birthdays: ${names}.`;
  };

  const buildDonorQuery = (filters, eligibleOnly = true, options = {}) => {
    const params = new URLSearchParams();
    if (filters.name.trim()) params.set('name', filters.name.trim());
    if (filters.location.trim()) params.set('location', filters.location.trim());
    if ((options.phone || '').trim()) params.set('phone', options.phone.trim());
    if (!eligibleOnly) params.set('eligibleOnly', 'false');
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return `/api/blood-drive/donors${query ? `?${query}` : ''}`;
  };

  const buildPresentationQuery = (path) => {
    const params = new URLSearchParams({ year: String(presentationYear) });
    return `${path}?${params.toString()}`;
  };

  const isBloodDrivePage = [
    pages.bloodDrive,
    pages.eligibleDonors,
    pages.repository,
    pages.donationLocations
  ].includes(page);
  const isRecruitmentPage = [
    pages.recruitment,
    pages.recruitmentRepository,
    pages.recruitmentCallCenter
  ].includes(page);
  const isPresentationPage = page === pages.presentations;
  const isQuetePage = [
    pages.quete,
    pages.queteBoard,
    pages.queteMembers,
    pages.queteShiftSetup,
    pages.queteReport,
    pages.queteFocals
  ].includes(page);
  const publicRecruitmentFormUrl = 'https://youth.lrcy-jbeil.online/#/recruitment-interest';
  const publicBloodDonorFormUrl = 'https://youth.lrcy-jbeil.online/#/blood-donor-interest';
  const canAccessBloodDrive = hasModuleAccess(me?.user, 'bloodDrive');
  const canAccessRecruitment = hasModuleAccess(me?.user, 'recruitment');
  const canAccessPresentations = hasModuleAccess(me?.user, 'presentations');
  const canAccessQuete = hasModuleAccess(me?.user, 'quete');
  const canAccessCertificateGenerator = hasModuleAccess(me?.user, 'certificateGenerator');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const mePayload = await api('/api/me', { token });
      const isAdmin = mePayload.user.role === 'admin';
      const isRecruit = mePayload.user.role === 'new recruit';
      const canLoadPresentations = hasModuleAccess(mePayload.user, 'presentations');

      const requestEntries = [
        ['birthdays', api('/api/birthdays', { token })]
      ];

      if (canLoadPresentations && isRecruit) {
        requestEntries.push(['presentation', api(buildPresentationQuery('/api/presentations/dashboard'), { token })]);
      }

      if (hasModuleAccess(mePayload.user, 'quete')) {
        requestEntries.push(['quete', api('/api/quete/dashboard', { token })]);
      }

      if (isAdmin) {
        requestEntries.push(['users', api('/api/users', { token })]);
        requestEntries.push(['settings', api('/api/settings', { token })]);
      }

      const settled = await Promise.allSettled(requestEntries.map(([, request]) => request));
      const payloads = {};
      const failures = [];

      settled.forEach((result, index) => {
        const [key] = requestEntries[index];
        if (result.status === 'fulfilled') payloads[key] = result.value;
        else failures.push(`${key}: ${result.reason?.message || 'request failed'}`);
      });

      setMe(mePayload);
      setBirthdays(payloads.birthdays || []);
      setDonorStats(createEmptyDonorStats());
      setEligibleDonors([]);
      setAllDonors([]);
      setPresentationData(payloads.presentation || createEmptyPresentationData(presentationYear));
      setQueteData(payloads.quete || createEmptyQueteData());
      setQueteShiftDraft(createEmptyQueteShift());
      setQueteAssignmentDraft({});
      setQueteFocalDraft(emptyQueteFocalDraft);
      setMemberBirthdayDraft(payloads.birthdays?.[0]?.birthdate || '');
      setNewBirthday((current) => ({
        ...current,
        name: isAdmin ? current.name : mePayload.user.displayName || mePayload.user.username
      }));
      setBloodDriveForm(emptyBloodDriveForm);
      setBloodDonorInterestForm(emptyBloodDonorInterestForm);
      setBloodDonorInterestCheckingDuplicate(false);
      setBloodDonorInterestError('');
      setBloodDonorInterestSuccess('');
      setCollectionLookupQuery('');
      setCollectionLookupResults([]);
      setSelectedCollectionDonor(null);
      setRepositoryDonorDraft(emptyRepositoryDonor);
      setRepositoryDonorError('');
      setDonationLocationDraft(emptyDonationLocation);
      setRecruitmentLeadDraft(emptyRecruitmentInterestForm);
      setRecruitmentLeadCreateError('');
      setRecruitmentFilters({ name: '', status: '' });
      setRecruitmentLeads([]);

      if (isAdmin) {
        setUsers(payloads.users || []);
        setSettings({
          botToken: payloads.settings?.botToken || '',
          birthdayChatId: payloads.settings?.birthdayChatId || '',
          timezone: payloads.settings?.timezone || 'Asia/Beirut',
          hasBotToken: Boolean(payloads.settings?.hasBotToken)
        });
        setPresentationReport(createEmptyPresentationReport());
      } else {
        setUsers([]);
        setPresentationReport(isRecruit ? {
          rankings: (payloads.presentation?.presenters || []).map((item) => ({
            presenter: item.user.displayName,
            username: item.user.username,
            topic: item.topic?.title || 'Unassigned',
            slot: item.slot?.startAt || null,
            totalScore: item.myEvaluation?.totalScore || null,
            scoredAt: item.myEvaluation?.updatedAt || null
          }))
        } : createEmptyPresentationReport());
      }

      if (failures.length) {
        setError(`Some dashboard sections failed to load: ${failures.join(' | ')}`);
      }
    } catch (err) {
      if (err.message === 'Unauthorized' || err.message === 'Invalid token' || err.message === 'User no longer has access') {
        localStorage.removeItem(tokenKey);
        setToken('');
        setMe(null);
        setError('');
        return;
      }

      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshPresentation = async ({ refreshReport = false } = {}) => {
    const requests = [api(buildPresentationQuery('/api/presentations/dashboard'), { token })];
    if (me?.user.role === 'admin' && refreshReport) requests.push(api(buildPresentationQuery('/api/presentations/report'), { token }));
    const [presentationPayload, reportPayload] = await Promise.all(requests);
    setPresentationData(presentationPayload);
    if (reportPayload) {
      setPresentationReport(reportPayload);
      return;
    }

    if (me?.user.role === 'admin') {
      setPresentationReport(createEmptyPresentationReport());
      return;
    }

    setPresentationReport({
      rankings: (presentationPayload?.presenters || []).map((item) => ({
        presenter: item.user.displayName,
        username: item.user.username,
        topic: item.topic?.title || 'Unassigned',
        slot: item.slot?.startAt || null,
        totalScore: item.myEvaluation?.totalScore || null,
        scoredAt: item.myEvaluation?.updatedAt || null
      }))
    });
  };

  const refreshBirthdays = async () => {
    const [birthdayPayload, mePayload] = await Promise.all([api('/api/birthdays', { token }), api('/api/me', { token })]);
    setBirthdays(birthdayPayload);
    setMe((current) => (current ? { ...current, ...mePayload } : mePayload));
    setMemberBirthdayDraft(birthdayPayload[0]?.birthdate || '');
  };

  const refreshUsers = async () => {
    const [usersPayload, mePayload] = await Promise.all([api('/api/users', { token }), api('/api/me', { token })]);
    setUsers(usersPayload);
    setMe((current) => (current ? { ...current, ...mePayload } : mePayload));
  };

  const refreshDonationLocations = async ({ includeAll = false } = {}) => {
    const path = `/api/blood-drive/locations${includeAll ? '?activeOnly=false' : ''}`;
    const payload = await api(path, { token });
    setDonationLocations(payload);
    return payload;
  };

  const buildRecruitmentQuery = (filters) => {
    const params = new URLSearchParams();
    if (filters.name.trim()) params.set('name', filters.name.trim());
    if (filters.status.trim()) params.set('status', filters.status.trim());
    const query = params.toString();
    return `/api/recruitment-interest${query ? `?${query}` : ''}`;
  };

  const refreshRecruitmentLeads = async (filters = recruitmentFilters) => {
    const payload = await api(buildRecruitmentQuery(filters), { token });
    setRecruitmentLeads(payload);
    return payload;
  };

  const refreshQuete = async () => {
    const payload = await api('/api/quete/dashboard', { token });
    setQueteData(payload);
    return payload;
  };

  const refreshBloodDrive = async ({ includeRepository = false, includeAllLocations = false } = {}) => {
    const [statsPayload, eligiblePayload, locationsPayload, repositoryPayload] = await Promise.all([
      api('/api/blood-drive/stats', { token }),
      api(buildDonorQuery(donorFilters, true), { token }),
      includeAllLocations ? api('/api/blood-drive/locations?activeOnly=false', { token }) : Promise.resolve(null),
      includeRepository ? api(buildDonorQuery(repositoryFilters, false), { token }) : Promise.resolve(null)
    ]);
    setDonorStats(statsPayload);
    setEligibleDonors(eligiblePayload);
    if (includeAllLocations && locationsPayload) {
      setDonationLocations(locationsPayload);
    }
    if (repositoryPayload) setAllDonors(repositoryPayload);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadData();
  }, [token]);

  useEffect(() => {
    const syncPageFromHash = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  useEffect(() => {
    const nextHash = getHashForPage(page);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [page]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [page]);

  useEffect(() => {
    if (!token || !me) {
      return;
    }

    if (
      (isBloodDrivePage && !canAccessBloodDrive) ||
      (isRecruitmentPage && !canAccessRecruitment) ||
      (isPresentationPage && !canAccessPresentations) ||
      (isQuetePage && !canAccessQuete) ||
      (page === pages.certificateGenerator && !canAccessCertificateGenerator)
    ) {
      setPage(pages.home);
      return;
    }

    if (isPresentationPage) {
      refreshPresentation({ refreshReport: me.user.role === 'admin' }).catch((err) => setError(err.message));
    }
    if (isQuetePage && canAccessQuete) {
      refreshQuete().catch((err) => setError(err.message));
    }
  }, [token, me, page, isBloodDrivePage, isRecruitmentPage, isPresentationPage, isQuetePage, canAccessBloodDrive, canAccessRecruitment, canAccessPresentations, canAccessQuete, canAccessCertificateGenerator, presentationYear]);

  useEffect(() => {
    if (!token || !me || (!isBloodDrivePage && !isRecruitmentPage)) {
      return;
    }

    if ((isBloodDrivePage && !canAccessBloodDrive) || (isRecruitmentPage && !canAccessRecruitment)) {
      return;
    }

    const includeRepository = page === pages.repository;
    const includeEligible = page === pages.eligibleDonors;
    const includeRecruitment = isRecruitmentPage;
    const requests = [];

    if (page === pages.bloodDrive) {
      requests.push(api('/api/blood-drive/stats', { token }).then(setDonorStats));
    }

    if (includeEligible) {
      requests.push(api(buildDonorQuery(donorFilters, true), { token }).then(setEligibleDonors));
    }

    if (includeRepository) {
      requests.push(api(buildDonorQuery(repositoryFilters, false), { token }).then(setAllDonors));
    }

    if (page === pages.donationLocations) {
      requests.push(refreshDonationLocations({ includeAll: true }));
    }

    if (includeRecruitment && canAccessRecruitment) {
      requests.push(refreshRecruitmentLeads());
    }

    Promise.all(requests).catch((err) => setError(err.message));
  }, [token, me, isBloodDrivePage, isRecruitmentPage, page, canAccessBloodDrive, canAccessRecruitment]);

  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem(tokenKey);
      setToken('');
      setPage(pages.home);
      setMe(null);
      setUsers([]);
      setError('');
      setNotice('');
      setLoading(false);
    };

    window.addEventListener('app:session-expired', handleSessionExpired);
    return () => window.removeEventListener('app:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    const nextOrder = getNextCriterionOrder(presentationData.admin?.criteria || []);
    setPresentationCriterionDraft((current) => ({
      ...current,
      order: current.title || current.description ? current.order : nextOrder
    }));
  }, [presentationData.admin?.criteria]);

  const handleLogin = (nextToken) => {
    localStorage.setItem(tokenKey, nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(tokenKey);
    setToken('');
    setPage(pages.home);
    setMe(null);
  };

  const createBirthday = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api('/api/birthdays', { token, method: 'POST', body: newBirthday });
      setNewBirthday(createEmptyBirthday());
      await refreshBirthdays();
      showNotice('Birthday record created successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const saveMemberBirthday = async (event) => {
    event.preventDefault();
    setMemberBirthdaySaving(true);
    setMemberBirthdayError('');
    try {
      const savedBirthday = await api('/api/birthdays', {
        token,
        method: 'POST',
        body: { name: me.user.displayName || me.user.username, birthdate: memberBirthdayDraft }
      });
      setBirthdayOverlayOpen(false);
      setBirthdays([savedBirthday]);
      setMemberBirthdayDraft(savedBirthday.birthdate);
      showNotice('Your birthday was saved successfully.');
    } catch (err) {
      setMemberBirthdayError(err.message);
    } finally {
      setMemberBirthdaySaving(false);
    }
  };

  const updateBirthday = async (id, payload) => {
    await api(`/api/birthdays/${id}`, { token, method: 'PUT', body: payload });
    await refreshBirthdays();
    showNotice('Birthday record updated successfully.');
  };

  const deleteBirthday = async (id) => {
    if (!window.confirm('Delete this birthday entry?')) return;
    await api(`/api/birthdays/${id}`, { token, method: 'DELETE' });
    await refreshBirthdays();
    showNotice('Birthday record deleted successfully.');
  };

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api('/api/users', { token, method: 'POST', body: newUser });
      setNewUser(createEmptyUser());
      await Promise.all([refreshUsers(), refreshPresentation({ refreshReport: true })]);
      showNotice('User account created successfully.');
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const updateUser = async (id, payload) => {
    await api(`/api/users/${id}`, { token, method: 'PUT', body: payload });
    await Promise.all([refreshUsers(), refreshPresentation({ refreshReport: true })]);
    showNotice('User account updated successfully.');
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = await api('/api/settings', {
        token,
        method: 'PUT',
        body: {
          botToken: settings.botToken,
          birthdayChatId: settings.birthdayChatId
        }
      });
      setSettings((current) => ({
        ...current,
        botToken: payload.botToken || '',
        birthdayChatId: payload.birthdayChatId || '',
        timezone: payload.timezone || current.timezone,
        hasBotToken: Boolean(payload.hasBotToken)
      }));
      showNotice('Telegram settings updated successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const runBirthdayNow = async () => {
    setError('');
    try {
      const result = await api('/api/birthdays/run-now', { token, method: 'POST' });
      showNotice(formatBirthdayRunMessage(result.matched));
    } catch (err) {
      setError(err.message);
    }
  };

  const saveBloodDriveRecord = async (event) => {
    event.preventDefault();
    setBloodDriveSaving(true);
    setBloodDriveError('');
    const currentFormSnapshot = { ...bloodDriveForm };
    try {
      await api('/api/blood-drive/donors', {
        token,
        method: 'POST',
        body: {
          ...bloodDriveForm,
          donorId: selectedCollectionDonor?.id || undefined
        }
      });
      setBloodDriveForm(emptyBloodDriveForm);
      setCollectionLookupQuery('');
      setCollectionLookupResults([]);
      setSelectedCollectionDonor(null);
      setBloodDriveOverlayOpen(false);
      await refreshBloodDrive({ includeRepository: true });
      showNotice('Blood donor record saved successfully.');
    } catch (err) {
      if (err.status === 409 && err.payload?.duplicateDonor && !selectedCollectionDonor) {
        const duplicateDonor = err.payload.duplicateDonor;
        selectCollectionDonor(duplicateDonor, {
          location: currentFormSnapshot.location,
          notes: currentFormSnapshot.notes
        });
        await api('/api/blood-drive/donors', {
          token,
          method: 'POST',
          body: {
            ...currentFormSnapshot,
            donorId: duplicateDonor.id
          }
        });
        setBloodDriveForm(emptyBloodDriveForm);
        setCollectionLookupQuery('');
        setCollectionLookupResults([]);
        setSelectedCollectionDonor(null);
        setBloodDriveOverlayOpen(false);
        await refreshBloodDrive({ includeRepository: true });
        showNotice('Existing blood donor record matched and updated successfully.');
        return;
      }
      setBloodDriveError(err.message);
    } finally {
      setBloodDriveSaving(false);
    }
  };

  const updateDonor = async (id, payload) => {
    await api(`/api/blood-drive/donors/${id}`, { token, method: 'PUT', body: payload });
    await refreshBloodDrive({ includeRepository: true });
    showNotice('Blood donor record updated successfully.');
  };

  const updateEligibleDonorCall = async (id, payload) => {
    const updated = await api(`/api/blood-drive/donors/${id}/contact`, { token, method: 'PUT', body: payload });
    await refreshBloodDrive({ includeRepository: true });
    showNotice('Call center record updated successfully.');
    return updated;
  };

  const exportBloodDriveDonations = async (date) => {
    try {
      setError('');
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      await downloadFile(`/api/blood-drive/donors/export?${params.toString()}`, {
        token,
        filename: `blood-donations-${date || 'today'}.xlsx`
      });
      showNotice('Donation export downloaded successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const markEligibleDonorAsDonated = (donor) => {
    selectCollectionDonor(donor);
    setBloodDriveError('');
    setBloodDriveOverlayOpen(true);
  };

  const createRepositoryDonor = async (event) => {
    event.preventDefault();
    setRepositoryDonorError('');
    try {
      await api('/api/blood-drive/donors/prospects', { token, method: 'POST', body: repositoryDonorDraft });
      setRepositoryDonorDraft(emptyRepositoryDonor);
      setRepositoryDonorError('');
      await refreshBloodDrive({ includeRepository: true });
      showNotice('Interested donor added to the repository.');
      return true;
    } catch (err) {
      setRepositoryDonorError(err.message);
      return false;
    }
  };

  const createDonationLocation = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api('/api/blood-drive/locations', { token, method: 'POST', body: donationLocationDraft });
      setDonationLocationDraft(emptyDonationLocation);
      setDonationLocations(await api('/api/blood-drive/locations?activeOnly=false', { token }));
      showNotice('Donation location created successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleDonationLocation = async (location) => {
    setError('');
    try {
      await api(`/api/blood-drive/locations/${location.id}`, {
        token,
        method: 'PUT',
        body: { active: !location.active }
      });
      setDonationLocations(await api('/api/blood-drive/locations?activeOnly=false', { token }));
      showNotice(`Donation location ${location.active ? 'disabled' : 'activated'} successfully.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteDonor = async (id) => {
    if (!window.confirm('Delete this blood donor record?')) return;
    await api(`/api/blood-drive/donors/${id}`, { token, method: 'DELETE' });
    await refreshBloodDrive({ includeRepository: true });
    showNotice('Blood donor record deleted successfully.');
  };

  const searchEligibleDonors = async () => setEligibleDonors(await api(buildDonorQuery(donorFilters, true), { token }));
  const searchRepositoryDonors = async () => setAllDonors(await api(buildDonorQuery(repositoryFilters, false), { token }));
  const searchRecruitmentLeads = async () => refreshRecruitmentLeads();

  const saveRecruitmentLeadContact = async (id, payload) => {
    const updated = await api(`/api/recruitment-interest/${id}/contact`, { token, method: 'PUT', body: payload });
    await refreshRecruitmentLeads();
    showNotice('Recruitment call record updated successfully.');
    return updated;
  };

  const createRecruitmentLead = async (event) => {
    event.preventDefault();
    setRecruitmentLeadCreateSaving(true);
    setRecruitmentLeadCreateError('');

    try {
      await api('/api/recruitment-interest', {
        token,
        method: 'POST',
        body: recruitmentLeadDraft
      });
      setRecruitmentLeadDraft(emptyRecruitmentInterestForm);
      await refreshRecruitmentLeads();
      showNotice('Interested person added successfully.');
      return true;
    } catch (err) {
      setRecruitmentLeadCreateError(err.message);
      return false;
    } finally {
      setRecruitmentLeadCreateSaving(false);
    }
  };

  const submitRecruitmentInterest = async (event) => {
    event.preventDefault();
    setRecruitmentLeadSaving(true);
    setRecruitmentLeadError('');
    setRecruitmentLeadSuccess('');

    try {
      await api('/api/recruitment-interest', {
        method: 'POST',
        body: recruitmentLeadForm
      });
      setRecruitmentLeadForm(emptyRecruitmentInterestForm);
      setRecruitmentLeadSuccess('Your interest form has been submitted successfully. A member of the recruitment team will contact you when the campaign begins.');
    } catch (err) {
      setRecruitmentLeadError(err.message);
    } finally {
      setRecruitmentLeadSaving(false);
    }
  };

  const submitBloodDonorInterest = async (event) => {
    event.preventDefault();
    if (bloodDonorInterestCheckingDuplicate || bloodDonorInterestError) {
      return;
    }
    setBloodDonorInterestSaving(true);
    setBloodDonorInterestError('');
    setBloodDonorInterestSuccess('');

    try {
      await api('/api/blood-drive/donors/public-interest', {
        method: 'POST',
        body: bloodDonorInterestForm
      });
      setBloodDonorInterestForm(emptyBloodDonorInterestForm);
      setBloodDonorInterestCheckingDuplicate(false);
      setBloodDonorInterestSuccess('Your registration has been submitted successfully. The blood drive team will contact you when a suitable future donation opportunity is available.');
    } catch (err) {
      setBloodDonorInterestError(err.message);
    } finally {
      setBloodDonorInterestSaving(false);
    }
  };

  useEffect(() => {
    if (page !== pages.bloodDonorInterestPublic) {
      return undefined;
    }

    const trimmedFirstName = bloodDonorInterestForm.firstName.trim();
    const trimmedLastName = bloodDonorInterestForm.lastName.trim();
    const trimmedPhoneNumber = bloodDonorInterestForm.phoneNumber.trim();
    const trimmedDateOfBirth = bloodDonorInterestForm.dateOfBirth.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedPhoneNumber || !trimmedDateOfBirth) {
      setBloodDonorInterestCheckingDuplicate(false);
      setBloodDonorInterestError('');
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const currentCheckId = bloodDonorDuplicateCheckIdRef.current + 1;
      bloodDonorDuplicateCheckIdRef.current = currentCheckId;
      setBloodDonorInterestCheckingDuplicate(true);

      try {
        const payload = await api('/api/blood-drive/donors/public-interest/check-duplicate', {
          method: 'POST',
          body: {
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            phoneNumber: trimmedPhoneNumber,
            dateOfBirth: trimmedDateOfBirth
          }
        });

        if (bloodDonorDuplicateCheckIdRef.current !== currentCheckId) {
          return;
        }

        setBloodDonorInterestError(
          payload.isDuplicate
            ? 'These details already match an existing registration.'
            : ''
        );
      } catch (err) {
        if (bloodDonorDuplicateCheckIdRef.current !== currentCheckId) {
          return;
        }
        setBloodDonorInterestError(err.message);
      } finally {
        if (bloodDonorDuplicateCheckIdRef.current === currentCheckId) {
          setBloodDonorInterestCheckingDuplicate(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      bloodDonorDuplicateCheckIdRef.current += 1;
      setBloodDonorInterestCheckingDuplicate(false);
    };
  }, [
    page,
    bloodDonorInterestForm.firstName,
    bloodDonorInterestForm.lastName,
    bloodDonorInterestForm.phoneNumber,
    bloodDonorInterestForm.dateOfBirth
  ]);

  const refreshCollectionLookup = async (value) => {
    const nextValue = String(value || '');
    if (nextValue.trim().length < 2) {
      setCollectionLookupResults([]);
      return;
    }

    const results = await api(
      buildDonorQuery({ name: nextValue, location: '' }, false, { phone: nextValue, limit: 8 }),
      { token }
    );
    setCollectionLookupResults(results);
  };

  const searchCollectionDonors = (value) => {
    setCollectionLookupQuery(String(value || ''));
  };

  const selectCollectionDonor = (donor, overrides = {}) => {
    setSelectedCollectionDonor(donor);
    setBloodDriveForm({
      firstName: donor.firstName,
      lastName: donor.lastName,
      dateOfBirth: donor.dateOfBirth,
      phoneNumber: donor.phoneNumber,
      location: overrides.location ?? donor.location ?? '',
      notes: overrides.notes ?? donor.notes ?? ''
    });
    setCollectionLookupQuery(donor.fullName);
    setCollectionLookupResults([]);
  };

  const clearSelectedCollectionDonor = () => {
    setSelectedCollectionDonor(null);
    setCollectionLookupQuery('');
    setCollectionLookupResults([]);
    setBloodDriveForm(emptyBloodDriveForm);
  };

  const saveQueteShift = async (event) => {
    event.preventDefault();
    try {
      if (queteShiftDraft.id) {
        await api(`/api/quete/shifts/${queteShiftDraft.id}`, { token, method: 'PUT', body: queteShiftDraft });
        showNotice('Quete shift updated successfully.');
      } else {
        await api('/api/quete/shifts', { token, method: 'POST', body: queteShiftDraft });
        showNotice('Quete shift created successfully.');
      }
      setQueteShiftDraft(createEmptyQueteShift());
      await refreshQuete();
    } catch (err) {
      setError(err.message);
    }
  };

  const reserveQueteShift = async (shiftId) => {
    try {
      const payload = await api(`/api/quete/shifts/${shiftId}/reserve`, { token, method: 'POST', body: {} });
      setQueteData(payload);
      showNotice('Quete seat reserved successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelOwnQueteReservation = async (shiftId) => {
    try {
      const payload = await api(`/api/quete/shifts/${shiftId}/reservations/me`, { token, method: 'DELETE' });
      setQueteData(payload);
      showNotice('Quete reservation cancelled successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const assignUserToQueteShift = async (shiftId) => {
    const userId = queteAssignmentDraft[shiftId]?.userId;
    if (!userId) {
      return;
    }

    try {
      const payload = await api(`/api/quete/shifts/${shiftId}/reservations/manage`, {
        token,
        method: 'POST',
        body: { userId }
      });
      setQueteAssignmentDraft((current) => ({ ...current, [shiftId]: { userId: '', query: '' } }));
      setQueteData(payload);
      showNotice('User added to quete shift successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const removeQueteReservation = async (shiftId, reservationId) => {
    try {
      const payload = await api(`/api/quete/shifts/${shiftId}/reservations/${reservationId}`, {
        token,
        method: 'DELETE'
      });
      setQueteData(payload);
      showNotice('Reservation removed successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const addQueteFocal = async () => {
    const userId = queteFocalDraft.userId;
    if (!userId) return;

    try {
      await api(`/api/users/${userId}`, {
        token,
        method: 'PUT',
        body: { isQueteFocal: true }
      });
      setQueteFocalDraft(emptyQueteFocalDraft);
      await Promise.all([refreshUsers(), refreshQuete()]);
      showNotice('Quete focal added successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const removeQueteFocal = async (userId) => {
    try {
      await api(`/api/users/${userId}`, {
        token,
        method: 'PUT',
        body: { isQueteFocal: false }
      });
      await Promise.all([refreshUsers(), refreshQuete()]);
      showNotice('Quete focal removed successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const exportQueteReport = async () => {
    try {
      await downloadFile('/api/quete/report/export', {
        token,
        filename: 'quete-report.xlsx'
      });
      showNotice('Quete report downloaded successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const isEditingFormField = () => {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)
    );
  };

  useEffect(() => {
    if (!token || !me || (!isBloodDrivePage && !isRecruitmentPage && !isQuetePage)) {
      return undefined;
    }

    if ((isBloodDrivePage && !canAccessBloodDrive) || (isRecruitmentPage && !canAccessRecruitment) || (isQuetePage && !canAccessQuete)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (isEditingFormField()) {
        return;
      }

      try {
        if (page === pages.bloodDrive) {
          const statsPayload = await api('/api/blood-drive/stats', { token });
          setDonorStats(statsPayload);
          return;
        }

        if (page === pages.eligibleDonors) {
          const eligiblePayload = await api(buildDonorQuery(donorFilters, true), { token });
          setEligibleDonors(eligiblePayload);
          return;
        }

        if (page === pages.repository) {
          const repositoryPayload = await api(buildDonorQuery(repositoryFilters, false), { token });
          setAllDonors(repositoryPayload);
          return;
        }

        if (page === pages.donationLocations) {
          setDonationLocations(await api('/api/blood-drive/locations?activeOnly=false', { token }));
          return;
        }

        if (isRecruitmentPage && canAccessRecruitment) {
          await refreshRecruitmentLeads();
          return;
        }

        if (isQuetePage && canAccessQuete) {
          await refreshQuete();
        }
      } catch (err) {
        setError(err.message);
      }
    }, bloodDriveRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [token, me, isBloodDrivePage, isRecruitmentPage, isQuetePage, page, donorFilters, repositoryFilters, recruitmentFilters, canAccessBloodDrive, canAccessRecruitment, canAccessQuete]);

  useEffect(() => {
    if (!token || !bloodDriveOverlayOpen || selectedCollectionDonor) {
      return undefined;
    }

    const trimmedQuery = collectionLookupQuery.trim();
    if (trimmedQuery.length < 2) {
      setCollectionLookupResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      refreshCollectionLookup(trimmedQuery).catch((err) => setBloodDriveError(err.message));
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [token, bloodDriveOverlayOpen, selectedCollectionDonor, collectionLookupQuery]);

  const spinPresentationTopic = async () => {
    setPresentationSpinning(true);
    try {
      await api('/api/presentations/spin', { token, method: 'POST', body: {} });
      await refreshPresentation();
      showNotice('Presentation topic assigned successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPresentationSpinning(false);
    }
  };

  const bookPresentationSlot = async (slotId) => {
    try {
      const payload = await api('/api/presentations/book-slot', { token, method: 'POST', body: { slotId } });
      setPresentationData((current) => {
        const previousBooking = current.recruit?.booking || null;
        const hadBooking = Boolean(previousBooking);
        const nextBooking = payload.booking;
        const nextSlots = (current.recruit?.slots || []).map((slot) => {
          const isTarget = slot.id === nextBooking.id;
          const wasOwnPrevious = previousBooking && slot.id === previousBooking.id;
          if (isTarget) return { ...slot, isBooked: true, booking: nextBooking.booking, bookedByName: me.user.displayName, startAt: nextBooking.startAt, endAt: nextBooking.endAt };
          if (wasOwnPrevious) return { ...slot, isBooked: false, booking: null, bookedByName: null };
          return slot;
        });
        return {
          ...current,
          stats: {
            ...current.stats,
            bookedPresentations: hadBooking ? current.stats.bookedPresentations : current.stats.bookedPresentations + 1,
            openSlots: hadBooking ? current.stats.openSlots : Math.max(0, current.stats.openSlots - 1)
          },
          recruit: current.recruit ? { ...current.recruit, booking: nextBooking, slots: nextSlots } : current.recruit
        };
      });
      setPage(pages.home);
      showNotice('Presentation slot reserved successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const createPresentationTopic = async (event) => {
    event.preventDefault();
    try {
      await api('/api/presentations/topics', { token, method: 'POST', body: presentationTopicDraft });
      setPresentationTopicDraft(emptyPresentationTopic);
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation topic added successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePresentationTopic = async (id) => {
    if (!window.confirm('Delete this presentation subject?')) return;
    try {
      await api(`/api/presentations/topics/${id}`, { token, method: 'DELETE' });
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation topic deleted successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const createPresentationSlot = async (event) => {
    event.preventDefault();
    try {
      await api('/api/presentations/slots', { token, method: 'POST', body: presentationSlotDraft });
      setPresentationSlotDraft(emptyPresentationSlot);
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation slots created successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePresentationSlot = async (id) => {
    if (!window.confirm('Delete this presentation spot?')) return;
    try {
      await api(`/api/presentations/slots/${id}`, { token, method: 'DELETE' });
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation slot deleted successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const createPresentationCriterion = async (event) => {
    event.preventDefault();
    try {
      await api('/api/presentations/criteria', { token, method: 'POST', body: presentationCriterionDraft });
      setPresentationCriterionDraft({
        ...emptyPresentationCriterion,
        order: getNextCriterionOrder([...(presentationData.admin?.criteria || []), { order: presentationCriterionDraft.order }])
      });
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation criterion added successfully.');
    } catch (err) {
      if (err.message.includes('order already exists')) {
        const nextOrder = getNextCriterionOrder(presentationData.admin?.criteria || []);
        setPresentationCriterionDraft((current) => ({ ...current, order: nextOrder }));
      }
      setError(err.message);
    }
  };

  const updatePresentationCriterion = async (id, payload) => {
    try {
      await api(`/api/presentations/criteria/${id}`, { token, method: 'PUT', body: payload });
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation criterion updated successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePresentationSecondAttempt = async (presenterId, allowSecondAttempt) => {
    try {
      await api(`/api/presentations/presenters/${presenterId}/allow-second-attempt`, { token, method: 'PATCH', body: { allowSecondAttempt } });
      await refreshPresentation({ refreshReport: true });
      showNotice(`Second attempt ${allowSecondAttempt ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePresentationCriterion = async (id) => {
    if (!window.confirm('Delete this presentation criterion?')) return;
    try {
      await api(`/api/presentations/criteria/${id}`, { token, method: 'DELETE' });
      await refreshPresentation({ refreshReport: true });
      showNotice('Presentation criterion deleted successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const savePresentationEvaluation = async (event) => {
    event.preventDefault();
    setError('');

    const attempt = Number(presentationScoreDraft.attempt || 1);
    const presenterId = presentationScoreDraft.presenterId;
    const scores = presentationData.activeCriteria.map((criterion) => ({ criterionId: criterion.id, score: Number(presentationScoreDraft.scores[criterion.id] || 1) }));
    const totalScore = calculatePresentationTotalScore(scores, presentationData.activeCriteria);
    const optimisticEvaluation = {
      id: `optimistic-${presenterId}-${me.user.id}-${attempt}`,
      presenterUserId: presenterId,
      evaluatorUserId: me.user.id,
      evaluator: me.user,
      attempt,
      totalScore,
      comment: presentationScoreDraft.comment,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      criteria: scores.map((item) => {
        const criterion = presentationData.activeCriteria.find((entry) => entry.id === item.criterionId);
        return { criterionId: item.criterionId, title: criterion?.title || '', order: criterion?.order || 0, score: item.score };
      })
    };

    setPresentationScoreOverlayOpen(false);
    setPresentationData((current) => ({
      ...current,
      presenters: current.presenters.map((presenter) => {
        if (presenter.user.id !== presenterId) return presenter;

        const nextEvaluations = [...(presenter.evaluations || []).filter((item) => !(item.evaluatorUserId === me.user.id && Number(item.attempt) === attempt)), optimisticEvaluation].sort((a, b) => Number(a.attempt || 1) - Number(b.attempt || 1));
        const nextMyEvaluations = [...(presenter.myEvaluations || []).filter((item) => Number(item.attempt) !== attempt), optimisticEvaluation].sort((a, b) => Number(a.attempt || 1) - Number(b.attempt || 1));
        const shouldRecalculateAverages = me.user.role === 'admin';
        const attempt1Evaluations = nextEvaluations.filter((item) => Number(item.attempt) === 1);
        const attempt2Evaluations = nextEvaluations.filter((item) => Number(item.attempt) === 2);

        return {
          ...presenter,
          evaluations: nextEvaluations,
          myEvaluations: nextMyEvaluations,
          myEvaluation: optimisticEvaluation,
          evaluation: optimisticEvaluation,
          attempt1Average: shouldRecalculateAverages ? (attempt1Evaluations.length ? Number((attempt1Evaluations.reduce((sum, item) => sum + getEvaluationTotalScore(item), 0) / attempt1Evaluations.length).toFixed(2)) : null) : presenter.attempt1Average,
          attempt2Average: shouldRecalculateAverages ? (attempt2Evaluations.length ? Number((attempt2Evaluations.reduce((sum, item) => sum + getEvaluationTotalScore(item), 0) / attempt2Evaluations.length).toFixed(2)) : null) : presenter.attempt2Average
        };
      })
    }));

    try {
      await api(`/api/presentations/evaluations/${presenterId}`, { token, method: 'PUT', body: { attempt, scores, comment: presentationScoreDraft.comment } });
      await refreshPresentation({ refreshReport: true });
      showNotice(`Attempt ${attempt} evaluation saved successfully.`);
    } catch (err) {
      await refreshPresentation({ refreshReport: true }).catch(() => {});
      setError(err.message);
    }
  };

  const generatePresentationReport = async () => {
    try {
      const payload = await api(buildPresentationQuery('/api/presentations/report'), { token });
      setPresentationReport(payload);
      showNotice('Presentation report refreshed successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (page === pages.recruitmentInterestPublic) {
    return (
      <RecruitmentInterestPage
        form={recruitmentLeadForm}
        onChange={(field, value) => {
          setRecruitmentLeadError('');
          setRecruitmentLeadSuccess('');
          setRecruitmentLeadForm((current) => ({ ...current, [field]: value }));
        }}
        onSubmit={submitRecruitmentInterest}
        saving={recruitmentLeadSaving}
        error={recruitmentLeadError}
        success={recruitmentLeadSuccess}
      />
    );
  }

  if (page === pages.bloodDonorInterestPublic) {
    return (
      <BloodDonorInterestPage
        form={bloodDonorInterestForm}
        onChange={(field, value) => {
          setBloodDonorInterestError('');
          setBloodDonorInterestSuccess('');
          setBloodDonorInterestForm((current) => ({ ...current, [field]: value }));
        }}
        onSubmit={submitBloodDonorInterest}
        saving={bloodDonorInterestSaving}
        checkingDuplicate={bloodDonorInterestCheckingDuplicate}
        error={bloodDonorInterestError}
        success={bloodDonorInterestSuccess}
      />
    );
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;
  if (loading) return <AppLoader title="Preparing your dashboard" subtitle="Loading access, workspace records, and your operational dashboard." />;
  if (!me) return <AppLoader title="Unable to load the dashboard" subtitle="The session could not be prepared. Try logging in again." />;

  const isAdmin = me.user.role === 'admin';
  const memberBirthday = birthdays[0] || null;
  const primaryNavigation = [
    { page: pages.home, label: 'Overview', visible: true },
    { page: pages.bloodDrive, label: 'Blood Drive', visible: canAccessBloodDrive },
    { page: pages.recruitment, label: 'Recruitment', visible: canAccessRecruitment },
    { page: pages.presentations, label: 'Presentations', visible: canAccessPresentations },
    { page: pages.quete, label: 'Quete', visible: canAccessQuete },
    { page: pages.certificateGenerator, label: 'Certificates', visible: canAccessCertificateGenerator }
  ].filter((item) => item.visible);
  const activePrimaryPage = isBloodDrivePage
    ? pages.bloodDrive
    : isRecruitmentPage
      ? pages.recruitment
      : isQuetePage
        ? pages.quete
        : page;
  const userInitials = (me.user.displayName || me.user.username || 'Member')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const breadcrumbItems = [];
  let breadcrumbPage = page;
  while (breadcrumbConfig[breadcrumbPage]) {
    breadcrumbItems.unshift({ page: breadcrumbPage, ...breadcrumbConfig[breadcrumbPage] });
    breadcrumbPage = breadcrumbConfig[breadcrumbPage].parent;
  }

  const renderPage = () => {
    if (page === pages.certificateGenerator && canAccessCertificateGenerator) {
      return (
        <CertificateGeneratorPage
          onBack={() => setPage(pages.home)}
          onNotice={showNotice}
        />
      );
    }

    if (isBloodDrivePage && canAccessBloodDrive) {
      return (
        <BloodDriveRouter
          page={page}
          donorStats={donorStats}
          publicFormUrl={publicBloodDonorFormUrl}
          donorFilters={donorFilters}
          setDonorFilters={setDonorFilters}
          eligibleDonors={eligibleDonors}
          repositoryFilters={repositoryFilters}
          setRepositoryFilters={setRepositoryFilters}
          repositoryDonorDraft={repositoryDonorDraft}
          setRepositoryDonorDraft={setRepositoryDonorDraft}
          repositoryDonorError={repositoryDonorError}
          donationLocationDraft={donationLocationDraft}
          setDonationLocationDraft={setDonationLocationDraft}
          allDonors={allDonors}
          donationLocations={donationLocations}
          isAdmin={isAdmin}
          onOpenCollection={() => {
            refreshDonationLocations().catch((err) => setError(err.message));
            setBloodDriveForm(emptyBloodDriveForm);
            setBloodDriveError('');
            setCollectionLookupQuery('');
            setCollectionLookupResults([]);
            setSelectedCollectionDonor(null);
            setBloodDriveOverlayOpen(true);
          }}
          onOpenEligibleDonors={() => setPage(pages.eligibleDonors)}
          onOpenRepository={() => setPage(pages.repository)}
          onOpenLocations={() => setPage(pages.donationLocations)}
          onExportDonations={exportBloodDriveDonations}
          onSearchEligible={searchEligibleDonors}
          onSearchRepository={searchRepositoryDonors}
          onCreateRepositoryDonor={createRepositoryDonor}
          onCreateDonationLocation={createDonationLocation}
          onToggleDonationLocation={toggleDonationLocation}
          onSaveDonor={updateDonor}
          onSaveEligibleDonor={updateEligibleDonorCall}
          onMarkEligibleDonorAsDonated={markEligibleDonorAsDonated}
          onDeleteDonor={deleteDonor}
          onBackToHub={() => setPage(pages.home)}
          onBackToBloodDrive={() => setPage(pages.bloodDrive)}
        />
      );
    }

    if (isRecruitmentPage && canAccessRecruitment) {
      return (
        <RecruitmentRouter
          page={page}
          recruitmentLeads={recruitmentLeads}
          recruitmentFilters={recruitmentFilters}
          setRecruitmentFilters={setRecruitmentFilters}
          recruitmentLeadDraft={recruitmentLeadDraft}
          setRecruitmentLeadDraft={setRecruitmentLeadDraft}
          recruitmentLeadCreateError={recruitmentLeadCreateError}
          recruitmentLeadCreateSaving={recruitmentLeadCreateSaving}
          publicFormUrl={publicRecruitmentFormUrl}
          canManageRecruitment={canAccessRecruitment}
          onOpenRepository={() => setPage(pages.recruitmentRepository)}
          onOpenCallCenter={() => setPage(pages.recruitmentCallCenter)}
          onSearchRecruitment={searchRecruitmentLeads}
          onCreateRecruitmentLead={createRecruitmentLead}
          onSaveRecruitmentLead={saveRecruitmentLeadContact}
          onBackToHub={() => setPage(pages.home)}
          onBackToRecruitment={() => setPage(pages.recruitment)}
        />
      );
    }

    if (page === pages.presentations && canAccessPresentations) {
      return (
        <PresentationRouter
          role={me.user.role}
          presentation={presentationData}
          report={presentationReport}
          selectedYear={presentationYear}
          onChangeYear={setPresentationYear}
          spinning={presentationSpinning}
          onSpin={spinPresentationTopic}
          onBookSlot={bookPresentationSlot}
          topicDraft={presentationTopicDraft}
          setTopicDraft={setPresentationTopicDraft}
          slotDraft={presentationSlotDraft}
          setSlotDraft={setPresentationSlotDraft}
          criterionDraft={presentationCriterionDraft}
          setCriterionDraft={setPresentationCriterionDraft}
          scoreDraft={presentationScoreDraft}
          setScoreDraft={setPresentationScoreDraft}
          scoreOverlayOpen={presentationScoreOverlayOpen}
          setScoreOverlayOpen={setPresentationScoreOverlayOpen}
          onCreateTopic={createPresentationTopic}
          onDeleteTopic={deletePresentationTopic}
          onCreateSlot={createPresentationSlot}
          onDeleteSlot={deletePresentationSlot}
          onCreateCriterion={createPresentationCriterion}
          onUpdateCriterion={updatePresentationCriterion}
          onDeleteCriterion={deletePresentationCriterion}
          onToggleSecondAttempt={togglePresentationSecondAttempt}
          onSaveEvaluation={savePresentationEvaluation}
          onGenerateReport={generatePresentationReport}
          onBack={() => setPage(pages.home)}
        />
      );
    }

    if (isQuetePage && canAccessQuete) {
      return (
        <QueteRouter
          page={page}
          me={me}
          data={queteData}
          canManage={queteData.canManage}
          draft={queteShiftDraft}
          setDraft={setQueteShiftDraft}
          focalDraft={queteFocalDraft}
          setFocalDraft={setQueteFocalDraft}
          assignmentDraft={queteAssignmentDraft}
          onAssignmentChange={(shiftId, value) => setQueteAssignmentDraft((current) => ({ ...current, [shiftId]: value }))}
          onSaveShift={saveQueteShift}
          onNavigate={setPage}
          onReserve={reserveQueteShift}
          onAssignUser={assignUserToQueteShift}
          onRemoveReservation={removeQueteReservation}
          onAddFocal={addQueteFocal}
          onRemoveFocal={removeQueteFocal}
          onExportReport={exportQueteReport}
          onBack={() => setPage(pages.home)}
          onResetShiftDraft={() => setQueteShiftDraft(createEmptyQueteShift())}
        />
      );
    }

    return (
      <HomePage
        page={page}
        me={me}
        memberBirthday={memberBirthday}
        presentationData={presentationData}
        queteData={queteData}
        donorStats={donorStats}
        birthdays={birthdays}
        users={users}
        settings={settings}
        setSettings={setSettings}
        newBirthday={newBirthday}
        setNewBirthday={setNewBirthday}
        newUser={newUser}
        setNewUser={setNewUser}
        onCreateBirthday={createBirthday}
        onUpdateBirthday={updateBirthday}
        onDeleteBirthday={deleteBirthday}
        onCreateUser={createUser}
        onUpdateUser={updateUser}
        onSaveSettings={saveSettings}
        onOpenBirthdayOverlay={() => setBirthdayOverlayOpen(true)}
        onOpenBloodDrive={() => setPage(pages.bloodDrive)}
        onOpenRecruitment={() => setPage(pages.recruitment)}
        onOpenPresentations={() => setPage(pages.presentations)}
        onOpenQuete={() => setPage(pages.quete)}
        onOpenCertificateGenerator={() => setPage(pages.certificateGenerator)}
        onOpenAdminBirthdays={() => setPage(pages.adminBirthdays)}
        onOpenAdminUsers={() => setPage(pages.adminUsers)}
        onOpenAdminSettings={() => setPage(pages.adminSettings)}
        onBackToAdminHome={() => setPage(pages.home)}
      />
    );
  };

  return (
    <div className="dashboard-shell">
      <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
        {notice ? <div className="notice-banner">{notice}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </div>
      <div className="dashboard-container">
        <header className="dashboard-hero">
          <div className="dashboard-brand">
            <div className="brand-mark" aria-hidden="true"><span /></div>
            <div>
              <div className="dashboard-eyebrow">Lebanese Red Cross · Jbeil</div>
              <h1>Youth Sector Hub</h1>
              <p>Operations and member services workspace</p>
            </div>
          </div>
          <nav className="primary-navigation" aria-label="Primary navigation">
            {primaryNavigation.map((item) => (
              <button
                key={item.page}
                type="button"
                className={activePrimaryPage === item.page ? 'active' : ''}
                aria-current={activePrimaryPage === item.page ? 'page' : undefined}
                onClick={() => setPage(item.page)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="dashboard-account">
            <div className="account-avatar" aria-hidden="true">{userInitials}</div>
            <div className="account-copy">
              <strong>{me.user.displayName}</strong>
              <span>{me.user.role}</span>
            </div>
            <div className="top-actions">
              {isAdmin ? <button type="button" className="secondary" onClick={runBirthdayNow}>Run Birthday Check</button> : null}
              <button type="button" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </header>

        <main className="workspace-main">
        <nav className="app-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbItems.map((item, index) => {
            const isCurrent = index === breadcrumbItems.length - 1;
            return (
              <span key={item.page} className="breadcrumb-item">
                {index > 0 ? <span className="breadcrumb-separator" aria-hidden="true">/</span> : null}
                {isCurrent ? (
                  <span className="breadcrumb-current" aria-current="page">{item.label}</span>
                ) : (
                  <button type="button" onClick={() => setPage(item.page)}>{item.label}</button>
                )}
              </span>
            );
          })}
        </nav>
        <Suspense
            fallback={
              <AppLoader
                title="Opening workspace section"
                subtitle="Loading the selected page and preparing its tools."
              />
            }
          >
            {renderPage()}
          </Suspense>

        <BirthdayOverlay
          isOpen={!isAdmin && !memberBirthday && birthdayOverlayOpen}
          birthdate={memberBirthdayDraft}
          onChange={setMemberBirthdayDraft}
          onClose={() => { setMemberBirthdayError(''); setBirthdayOverlayOpen(false); }}
          onSubmit={saveMemberBirthday}
          saving={memberBirthdaySaving}
          error={memberBirthdayError}
        />
        <BloodDriveOverlay
          isOpen={bloodDriveOverlayOpen}
          form={bloodDriveForm}
          activeLocations={donationLocations}
          onChange={(field, value) => setBloodDriveForm((current) => ({ ...current, [field]: value }))}
          lookupQuery={collectionLookupQuery}
          lookupResults={collectionLookupResults}
          selectedDonor={selectedCollectionDonor}
          onLookupQueryChange={searchCollectionDonors}
          onSelectDonor={selectCollectionDonor}
          onClearSelectedDonor={clearSelectedCollectionDonor}
          onClose={() => {
            setBloodDriveForm(emptyBloodDriveForm);
            setBloodDriveError('');
            setCollectionLookupQuery('');
            setCollectionLookupResults([]);
            setSelectedCollectionDonor(null);
            setBloodDriveOverlayOpen(false);
          }}
          onSubmit={saveBloodDriveRecord}
          saving={bloodDriveSaving}
          error={bloodDriveError}
        />
        </main>
      </div>
    </div>
  );
}
