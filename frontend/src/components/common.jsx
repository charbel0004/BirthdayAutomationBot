import { useEffect, useState } from 'react';
import {
  api,
  formatBirthdayForDisplay,
  formatCompactDate,
  formatDateTime,
  getDaysUntilBirthday,
  months,
  monthMaxDays
} from '../lib/app';

export function LoaderAvatar() {
  return (
    <svg className="loader-avatar" viewBox="0 0 120 120" role="presentation">
      <defs>
        <linearGradient id="uniformFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6f879c" />
          <stop offset="100%" stopColor="#4c6378" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="rgba(255,255,255,0.72)" />
      <path d="M60 24c8 0 14 7 14 15s-6 14-14 14-14-6-14-14 6-15 14-15Z" fill="#17202a" />
      <path d="M36 58c4-8 14-12 24-12s20 4 24 12l5 34c1 7-4 14-11 14H42c-7 0-12-7-11-14l5-34Z" fill="url(#uniformFill)" />
      <path d="M37 61h46" stroke="#d9e3ef" strokeWidth="4" strokeLinecap="round" />
      <path d="M34 68h52" stroke="#d9e3ef" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="76" r="14" fill="#fffaf7" stroke="#d8d7d4" strokeWidth="2" />
      <path d="M60 67v18M51 76h18" stroke="#ba2028" strokeWidth="6" strokeLinecap="round" />
      <path d="M39 56l-6 13M81 56l6 13" stroke="#52687b" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function BloodDriveIcon() {
  return (
    <svg viewBox="0 0 120 120" className="module-icon-svg" aria-hidden="true">
      <circle cx="60" cy="60" r="46" fill="#fff7f1" />
      <path d="M60 28c-10 15-20 24-20 37 0 12 9 22 20 22s20-10 20-22c0-13-10-22-20-37Z" fill="#b12028" />
      <path d="M60 48c-5 9-10 14-10 22 0 6 4 12 10 12s10-6 10-12c0-8-5-13-10-22Z" fill="#f8d6d8" />
    </svg>
  );
}

export function PresentationIcon() {
  return (
    <svg viewBox="0 0 120 120" className="module-icon-svg" aria-hidden="true">
      <rect x="18" y="22" width="84" height="60" rx="12" fill="#fff8f2" stroke="#d9c2b4" strokeWidth="4" />
      <path d="M30 38h60M30 52h38M30 66h46" stroke="#b12028" strokeWidth="6" strokeLinecap="round" />
      <circle cx="88" cy="88" r="14" fill="#b12028" />
      <path d="M88 80v16M80 88h16" stroke="#fff7f1" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function AppLoader({ title, subtitle }) {
  return (
    <div className="loading-screen">
      <div className="loader-card">
        <div className="loader-emblem" aria-hidden="true">
          <span className="loader-ring loader-ring-a" />
          <span className="loader-ring loader-ring-b" />
          <LoaderAvatar />
        </div>
        <div className="loader-copy">
          <div className="panel-kicker">Youth Sector Hub</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function BirthdatePicker({ value, onChange }) {
  const splitBirthdate = (nextValue) => {
    if (!nextValue || !nextValue.includes('-')) {
      return { month: '', day: '' };
    }
    const [month, day] = nextValue.split('-');
    return { month, day };
  };

  const { month, day } = splitBirthdate(value);
  const maxDay = month ? monthMaxDays[month] : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, '0'));

  const updateMonth = (nextMonth) => {
    if (!nextMonth) {
      onChange('');
      return;
    }

    if (!day) {
      onChange(`${nextMonth}-01`);
      return;
    }

    const limit = monthMaxDays[nextMonth];
    const nextDay = Number(day) > limit ? String(limit).padStart(2, '0') : day;
    onChange(`${nextMonth}-${nextDay}`);
  };

  const updateDay = (nextDay) => {
    if (!month || !nextDay) {
      onChange('');
      return;
    }

    onChange(`${month}-${nextDay}`);
  };

  return (
    <div className="birthday-picker">
      <select value={month} onChange={(event) => updateMonth(event.target.value)} required>
        <option value="">Month</option>
        {months.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select value={day} onChange={(event) => updateDay(event.target.value)} required>
        <option value="">Day</option>
        {dayOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    displayName: '',
    username: '',
    password: '',
    birthdate: '',
    role: 'member'
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const payload = await api('/api/auth/login', { method: 'POST', body: loginForm });
      onLogin(payload.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const submitSignup = async (event) => {
    event.preventDefault();
    setSignupLoading(true);
    setSignupError('');

    try {
      const payload = await api('/api/auth/signup', { method: 'POST', body: signupForm });
      onLogin(payload.token);
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-backdrop" />
      <main className="login-grid">
        <section className="hero-panel">
          <div className="hero-badge">Lebanese Red Cross</div>
          <h1>Red Cross Youth Sector Hub</h1>
          <p className="hero-copy">
            A professional workspace for youth sector operations, presentation coordination,
            blood drive records, and internal member tools.
          </p>
          <div className="feature-list">
            <article>
              <strong>Structured access</strong>
              <span>Admins, members, and new recruits use the same secure workspace with separate experiences.</span>
            </article>
            <article>
              <strong>Presentation control</strong>
              <span>Manage topic assignment, time slots, scoring, and reporting in one central system.</span>
            </article>
            <article>
              <strong>Existing automation preserved</strong>
              <span>Birthday messaging and Telegram settings continue to use the current backend setup.</span>
            </article>
          </div>
        </section>
        <section className="login-panel">
          <div className="panel-kicker">Secure Access</div>
          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
          </div>

          {mode === 'login' ? (
            <>
              <h2>Sign in to Hub</h2>
              <p>Use your assigned username and password to access the workspace.</p>
              <form onSubmit={submitLogin} className="grid-form">
                <label>
                  Username
                  <input value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Enter your username" required />
                </label>
                <label>
                  Password
                  <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter your password" required />
                </label>
                {loginError ? <div className="error-banner">{loginError}</div> : null}
                <button type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Signing in...' : 'Log in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Create your account</h2>
              <p>Register yourself as a member or new recruit and save your birthday during signup.</p>
              <form onSubmit={submitSignup} className="grid-form">
                <label>
                  Full name
                  <input value={signupForm.displayName} onChange={(event) => setSignupForm({ ...signupForm, displayName: event.target.value })} placeholder="Enter your full name" required />
                </label>
                <label>
                  Username
                  <input value={signupForm.username} onChange={(event) => setSignupForm({ ...signupForm, username: event.target.value })} placeholder="Choose a username" required />
                </label>
                <label>
                  Password
                  <input type="password" value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} placeholder="Choose a password" required />
                </label>
                <label>
                  Role
                  <select value={signupForm.role} onChange={(event) => setSignupForm({ ...signupForm, role: event.target.value })} required>
                    <option value="member">Member</option>
                    <option value="new recruit">New recruit</option>
                  </select>
                </label>
                <label>
                  Date of birth
                  <BirthdatePicker value={signupForm.birthdate} onChange={(birthdate) => setSignupForm({ ...signupForm, birthdate })} />
                </label>
                {signupError ? <div className="error-banner">{signupError}</div> : null}
                <button type="submit" disabled={signupLoading}>
                  {signupLoading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export function RecruitmentInterestPage({ form, onChange, onSubmit, saving, error, success }) {
  return (
    <div className="login-shell">
      <div className="login-backdrop" />
      <main className="login-grid">
        <section className="hero-panel">
          <div className="hero-badge">Lebanese Red Cross</div>
          <h1>Recruitment Interest Form</h1>
          <p className="hero-copy">
            Complete this form to register your interest in joining the Lebanese Red Cross Youth Sector, Jbeil Center. A member of the recruitment team will review your submission and contact you once our recruitment campaign starts.
          </p>
        </section>
        <section className="login-panel">
          <div className="panel-kicker">Recruitment</div>
          <h2>Interested in joining?</h2>
          <p>Fill in your details and the recruitment call center will follow up with you.</p>
          <form onSubmit={onSubmit} className="grid-form">
            <label>
              First name
              <input value={form.firstName} onChange={(event) => onChange('firstName', event.target.value)} required />
            </label>
            <label>
              Last name
              <input value={form.lastName} onChange={(event) => onChange('lastName', event.target.value)} required />
            </label>
            <label>
              Phone number
              <input value={form.phoneNumber} onChange={(event) => onChange('phoneNumber', event.target.value)} required />
            </label>
            <label>
              Date of birth
              <input type="date" value={form.dateOfBirth} onChange={(event) => onChange('dateOfBirth', event.target.value)} required />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            {success ? <div className="notice-banner">{success}</div> : null}
            <button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Interest'}</button>
          </form>
        </section>
      </main>
    </div>
  );
}

export function MetricBarChart({ title, items }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="chart-bars">
        {items.map((item) => (
          <div key={item.label} className="chart-row">
            <span>{item.label}</span>
            <div className="chart-track">
              <div className="chart-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ModuleCard({ title, description, icon, onClick, actionLabel = 'Open' }) {
  return (
    <button type="button" className="module-card" onClick={onClick} disabled={!onClick}>
      <div className="module-icon">{icon}</div>
      <div className="module-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="module-link">{actionLabel}</span>
    </button>
  );
}

export function PresentationYearFilter({ years, value, onChange }) {
  if (!years?.length) return null;

  return (
    <label className="inline-select">
      <span>Year</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </label>
  );
}

export function BirthdayModuleCard({ memberName, birthday, onClick }) {
  const daysLeft = birthday ? getDaysUntilBirthday(birthday.birthdate) : null;
  const isToday = daysLeft === 0;
  const title = birthday
    ? isToday
      ? 'Birthday Countdown'
      : `${daysLeft} Day${daysLeft === 1 ? '' : 's'} Until Your Birthday`
    : 'Birthday Countdown';
  const description = birthday
    ? isToday
      ? `Happy birthday, ${memberName}. Your celebration day is here.`
      : `Your saved birthday is ${formatBirthdayForDisplay(birthday.birthdate)}.`
    : 'Add your birthday date and activate your personal countdown card.';

  return (
    <ModuleCard
      title={title}
      description={description}
      icon={<div className="module-icon-text">🎂</div>}
      onClick={birthday ? undefined : onClick}
      actionLabel={birthday ? 'Saved' : 'Add'}
    />
  );
}

export function PresentationModuleCard({ role, recruitState, onOpen }) {
  if (role === 'new recruit') {
    const isLocked = Boolean(recruitState?.topic && recruitState?.booking);
    return (
      <ModuleCard
        title={recruitState?.topic ? 'Presentation Assignment' : 'Presentation Wheel'}
        description={
          isLocked
            ? `${recruitState.topic.title} • ${formatDateTime(recruitState.booking.startAt)}`
            : recruitState?.topic
              ? 'Your topic is assigned. Open the presentation page to review your topic and choose a time slot.'
              : 'Spin the wheel to receive your presentation topic, then reserve your presentation slot.'
        }
        icon={<PresentationIcon />}
        onClick={isLocked ? undefined : onOpen}
        actionLabel={isLocked ? 'Scheduled' : recruitState?.topic ? 'View' : 'Spin'}
      />
    );
  }

  return (
    <ModuleCard
      title="Presentations"
      description="Open presenters, topics, grading criteria, results, and presentation operations."
      icon={<PresentationIcon />}
      onClick={onOpen}
    />
  );
}

export function BirthdayOverlay({ isOpen, birthdate, onChange, onClose, onSubmit, saving, error }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card birthday-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Add Your Birthday</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <p>Save your birthday once so the central system can count down to your next celebration.</p>
        <form onSubmit={onSubmit} className="grid-form">
          <label>
            Birthday Date
            <BirthdatePicker value={birthdate} onChange={onChange} />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Birthday'}</button>
        </form>
      </div>
    </div>
  );
}

export function BloodDriveOverlay({
  isOpen,
  form,
  activeLocations,
  lookupQuery,
  lookupResults,
  selectedDonor,
  onLookupQueryChange,
  onSelectDonor,
  onClearSelectedDonor,
  onChange,
  onClose,
  onSubmit,
  saving,
  error
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card blood-drive-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Blood Drive Data Collection</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <p>Search the repository first. Select an existing donor on donation day, or add a new donor only if no record exists.</p>
        <form onSubmit={onSubmit} className="grid-form">
          <div className="lookup-panel">
            <label>
              Find existing donor
              <input value={lookupQuery} onChange={(event) => onLookupQueryChange(event.target.value)} placeholder="Search by name or phone" />
            </label>
            {selectedDonor ? (
              <div className="lookup-selected">
                <strong>{selectedDonor.fullName}</strong>
                <span>{selectedDonor.phoneNumber} · Latest location: {selectedDonor.location || 'None'}</span>
                <button type="button" className="secondary" onClick={onClearSelectedDonor}>Use New Donor Instead</button>
              </div>
            ) : null}
            {!selectedDonor && lookupResults.length ? (
              <div className="lookup-results">
                {lookupResults.map((donor) => (
                  <button key={donor.id} type="button" className="secondary lookup-result-button" onClick={() => onSelectDonor(donor)}>
                    {donor.fullName} · {donor.phoneNumber} · {donor.location}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label>
            First name
            <input value={form.firstName} onChange={(event) => onChange('firstName', event.target.value)} required />
          </label>
          <label>
            Last name
            <input value={form.lastName} onChange={(event) => onChange('lastName', event.target.value)} required />
          </label>
          <label>
            Date of birth
            <input type="date" value={form.dateOfBirth} onChange={(event) => onChange('dateOfBirth', event.target.value)} required />
          </label>
          <label>
            Phone number
            <input value={form.phoneNumber} onChange={(event) => onChange('phoneNumber', event.target.value)} required />
          </label>
          <label>
            Donation day location
            <select value={form.location} onChange={(event) => onChange('location', event.target.value)} required>
              <option value="">Select an active location</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.name}>{location.name}</option>
              ))}
            </select>
          </label>
          <label>
            Notes / comments
            <textarea value={form.notes || ''} onChange={(event) => onChange('notes', event.target.value)} placeholder="Call notes, confirmation details, or donor comments" />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Donor Record'}</button>
        </form>
      </div>
    </div>
  );
}

export function DonorProspectOverlay({ isOpen, draft, setDraft, onClose, onSubmit, error }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card blood-drive-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Add Interested Donor</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <p>Use this for people who did not donate this time but want to donate later. They will show in the call-center eligible list.</p>
        <form onSubmit={onSubmit} className="grid-form">
          <label>
            First name
            <input value={draft.firstName} onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))} required />
          </label>
          <label>
            Last name
            <input value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} required />
          </label>
          <label>
            Date of birth
            <input type="date" value={draft.dateOfBirth} onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} required />
          </label>
          <label>
            Phone number
            <input value={draft.phoneNumber} onChange={(event) => setDraft((current) => ({ ...current, phoneNumber: event.target.value }))} required />
          </label>
          <label>
            Initial notes
            <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit">Add To Call Center List</button>
        </form>
      </div>
    </div>
  );
}

export function RecruitmentInterestOverlay({ isOpen, draft, setDraft, onClose, onSubmit, error, saving }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card blood-drive-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Add Interested Person</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <p>Add a recruitment lead directly to the repository without using the QR form.</p>
        <form onSubmit={onSubmit} className="grid-form">
          <label>
            First name
            <input value={draft.firstName} onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))} required />
          </label>
          <label>
            Last name
            <input value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} required />
          </label>
          <label>
            Phone number
            <input value={draft.phoneNumber} onChange={(event) => setDraft((current) => ({ ...current, phoneNumber: event.target.value }))} required />
          </label>
          <label>
            Date of birth
            <input type="date" value={draft.dateOfBirth} onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} required />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Interested Person'}</button>
        </form>
      </div>
    </div>
  );
}

export function BirthdayRow({ entry, onSave, onDelete }) {
  const [draft, setDraft] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(entry);
  }, [entry]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(entry.id, draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></td>
      <td><BirthdatePicker value={draft.birthdate} onChange={(birthdate) => setDraft({ ...draft, birthdate })} /></td>
      <td>{formatBirthdayForDisplay(entry.birthdate)}</td>
      <td><label className="inline-checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active</label></td>
      <td>{entry.createdBy || 'self'}</td>
      <td className="actions">
        <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        <button type="button" className="secondary" onClick={() => onDelete(entry.id)}>Delete</button>
      </td>
      <td>{error ? <span className="small-error">{error}</span> : null}</td>
    </tr>
  );
}

export function UserRow({ user, onSave }) {
  const [draft, setDraft] = useState({ username: user.username, displayName: user.displayName, role: user.role, active: user.active, password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({ username: user.username, displayName: user.displayName, role: user.role, active: user.active, password: '' });
  }, [user]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(user.id, draft);
      setDraft((current) => ({ ...current, password: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></td>
      <td><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></td>
      <td>
        <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="new recruit">New Recruit</option>
        </select>
      </td>
      <td><label className="inline-checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active</label></td>
      <td><input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Leave blank" /></td>
      <td className="actions"><button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></td>
      <td>{error ? <span className="small-error">{error}</span> : null}</td>
    </tr>
  );
}

export function DonorRow({ donor, onSave, onDelete, editable }) {
  const [draft, setDraft] = useState({
    firstName: donor.firstName,
    lastName: donor.lastName,
    dateOfBirth: donor.dateOfBirth,
    phoneNumber: donor.phoneNumber,
    location: donor.location
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({
      firstName: donor.firstName,
      lastName: donor.lastName,
      dateOfBirth: donor.dateOfBirth,
      phoneNumber: donor.phoneNumber,
      location: donor.location
    });
  }, [donor]);

  const hasChanges =
    draft.firstName !== donor.firstName ||
    draft.lastName !== donor.lastName ||
    draft.dateOfBirth !== donor.dateOfBirth ||
    draft.phoneNumber !== donor.phoneNumber ||
    draft.location !== donor.location;

  const save = async () => {
    if (!editable || saving || !hasChanges) return;

    setSaving(true);
    setError('');
    try {
      await onSave(donor.id, draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    save();
  };

  return (
    <tr className="repository-table-row">
      <td>{editable ? <input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} onBlur={save} onKeyDown={handleKeyDown} /> : <span className="repository-cell-value">{donor.firstName}</span>}</td>
      <td>{editable ? <input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} onBlur={save} onKeyDown={handleKeyDown} /> : <span className="repository-cell-value">{donor.lastName}</span>}</td>
      <td><span className="repository-cell-value repository-cell-value-center">{donor.age}</span></td>
      <td>{editable ? <input type="date" value={draft.dateOfBirth} onChange={(event) => setDraft({ ...draft, dateOfBirth: event.target.value })} onBlur={save} onKeyDown={handleKeyDown} /> : <span className="repository-cell-value">{formatCompactDate(donor.dateOfBirth)}</span>}</td>
      <td>{editable ? <input value={draft.phoneNumber} onChange={(event) => setDraft({ ...draft, phoneNumber: event.target.value })} onBlur={save} onKeyDown={handleKeyDown} /> : <span className="repository-cell-value">{donor.phoneNumber}</span>}</td>
      <td>{editable ? <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} onBlur={save} onKeyDown={handleKeyDown} /> : <span className="repository-cell-value">{donor.location}</span>}</td>
      <td><span className="repository-cell-value">{donor.lastDonationDate ? formatCompactDate(donor.lastDonationDate) : 'Not donated yet'}</span></td>
      <td><span className="repository-cell-value">{saving ? 'Saving...' : formatCompactDate(donor.lastUpdatedDate)}</span></td>
      <td>{error ? <span className="small-error repository-cell-value">{error}</span> : <span className="repository-cell-value">{donor.updatedByName}</span>}</td>
      <td><span className="repository-cell-value">{hasChanges && !saving ? 'Unsaved changes' : formatCompactDate(donor.nextEligibleDonationDate)}</span></td>
    </tr>
  );
}

export function DonorRepositoryCard({ donor }) {
  const statusLabel = donor.lastDonationDate ? 'Previous donor' : 'Interested donor';
  const eligibleLabel = donor.nextEligibleDonationDate ? `Eligible ${formatCompactDate(donor.nextEligibleDonationDate)}` : 'No eligibility date';
  const rows = [
    ['Age', donor.age ?? '—'],
    ['Date of birth', formatCompactDate(donor.dateOfBirth)],
    ['Phone', donor.phoneNumber || '—'],
    ['Latest location', donor.location || '—'],
    ['Last donation', donor.lastDonationDate ? formatCompactDate(donor.lastDonationDate) : 'Not donated yet'],
    ['Last update', formatCompactDate(donor.lastUpdatedDate)],
    ['Updated by', donor.updatedByName || '—'],
    ['Next eligible', formatCompactDate(donor.nextEligibleDonationDate)]
  ];

  return (
    <article className="repository-card">
      <div className="repository-card-head">
        <div>
          <h3>{donor.fullName || `${donor.firstName} ${donor.lastName}`.trim()}</h3>
          <p>{donor.phoneNumber || 'No phone number recorded'}</p>
        </div>
        <div className="repository-card-badges">
          <span className="repository-badge">{statusLabel}</span>
          <span className="repository-badge repository-badge-soft">{eligibleLabel}</span>
        </div>
      </div>
      <div className="repository-card-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="repository-card-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function CallCenterRecordPanel({ donor, onSave, onMarkDonated, editable, isOpen, onClose }) {
  const [draft, setDraft] = useState({
    callStatus: donor.callStatus || '',
    upcomingDonationDate: donor.upcomingDonationDate || '',
    notes: donor.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({
      callStatus: donor.callStatus || '',
      upcomingDonationDate: donor.upcomingDonationDate || '',
      notes: donor.notes || ''
    });
  }, [donor]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(donor.id, {
        callStatus: draft.callStatus,
        upcomingDonationDate: draft.callStatus === 'upcoming' ? draft.upcomingDonationDate : '',
        notes: draft.notes
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="call-center-record-card">
      <div className="call-center-record-topbar">
        <h3>Call Center Record</h3>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <div className="call-center-record-head">
        <div>
          <h3>{donor.fullName}</h3>
          <p>{donor.phoneNumber || 'No phone number'}{donor.location ? ` · ${donor.location}` : ''}</p>
        </div>
        <div className="call-center-meta">
          <span>Eligible: {donor.nextEligibleDonationDate}</span>
          <span>Last call: {donor.lastCallDate || 'No call record yet'}</span>
        </div>
      </div>
      <div className="grid-form">
        <label>
          Call result
          <select value={draft.callStatus} onChange={(event) => setDraft({ ...draft, callStatus: event.target.value })} disabled={!editable}>
            <option value="">Select result</option>
            <option value="upcoming">Willing, may come on a date</option>
            <option value="not-willing">Not willing</option>
            <option value="no-answer">No answer</option>
          </select>
        </label>
        {draft.callStatus === 'upcoming' ? (
          <label>
            Upcoming date
            <input type="date" value={draft.upcomingDonationDate} onChange={(event) => setDraft({ ...draft, upcomingDonationDate: event.target.value })} disabled={!editable} required />
          </label>
        ) : null}
        <label>
          Notes
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Call notes and comments" disabled={!editable} />
        </label>
        <div className="helper-text">The call date is recorded automatically when you save this record.</div>
      </div>
      <div className="actions">
        {editable ? (
          <>
            <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" className="secondary" onClick={() => onMarkDonated?.(donor)}>Mark Donated</button>
          </>
        ) : (
          <span className="helper-text">Read only</span>
        )}
      </div>
      {error ? <span className="small-error">{error}</span> : null}
      <div className="call-center-history">
        <h4>Call history</h4>
        {donor.callHistory?.length ? (
          donor.callHistory.slice(0, 5).map((entry, index) => (
            <div key={`${entry.callDate}-${index}`} className="call-history-item">
              <strong>{entry.callDate || 'Unknown date'}</strong>
              <span>{entry.callStatus || 'No status'}{entry.upcomingDonationDate ? ` · Upcoming: ${entry.upcomingDonationDate}` : ''}</span>
              <span>{entry.recordedByName || 'Unknown user'}</span>
              <p>{entry.notes || 'No notes'}</p>
            </div>
          ))
        ) : (
          <p className="helper-text">No call records yet.</p>
        )}
      </div>
    </article>
  );
}

export function RecruitmentCallCenterPanel({ lead, onSave, editable, isOpen, onClose }) {
  const [draft, setDraft] = useState({
    callStatus: lead.callStatus || '',
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({
      callStatus: lead.callStatus || '',
      followUpDate: lead.followUpDate || '',
      notes: lead.notes || ''
    });
  }, [lead]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(lead.id, draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="call-center-record-card">
      <div className="call-center-record-topbar">
        <h3>Recruitment Call Record</h3>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <div className="call-center-record-head">
        <div>
          <h3>{lead.fullName}</h3>
          <p>{lead.phoneNumber || 'No phone number'}{lead.dateOfBirth ? ` · DOB: ${lead.dateOfBirth}` : ''}</p>
        </div>
        <div className="call-center-meta">
          <span>Status: {lead.callStatus || 'New'}</span>
          <span>Last call: {lead.lastCallDate || 'No call record yet'}</span>
        </div>
      </div>
      <div className="grid-form">
        <label>
          Call result
          <select value={draft.callStatus} onChange={(event) => setDraft({ ...draft, callStatus: event.target.value })} disabled={!editable}>
            <option value="">Select result</option>
            <option value="follow-up">Needs follow-up</option>
            <option value="scheduled">Scheduled for recruitment</option>
            <option value="not-interested">Not interested</option>
            <option value="no-answer">No answer</option>
          </select>
        </label>
        {['follow-up', 'scheduled'].includes(draft.callStatus) ? (
          <label>
            Follow-up date
            <input type="date" value={draft.followUpDate} onChange={(event) => setDraft({ ...draft, followUpDate: event.target.value })} disabled={!editable} required />
          </label>
        ) : null}
        <label>
          Notes
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Recruitment call notes" disabled={!editable} />
        </label>
      </div>
      <div className="actions">
        {editable ? <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button> : <span className="helper-text">Read only</span>}
      </div>
      {error ? <span className="small-error">{error}</span> : null}
      <div className="call-center-history">
        <h4>Call history</h4>
        {lead.callHistory?.length ? (
          lead.callHistory.slice(0, 5).map((entry, index) => (
            <div key={`${entry.callDate}-${index}`} className="call-history-item">
              <strong>{entry.callDate || 'Unknown date'}</strong>
              <span>{entry.callStatus || 'No status'}{entry.followUpDate ? ` · Follow-up: ${entry.followUpDate}` : ''}</span>
              <span>{entry.recordedByName || 'Unknown user'}</span>
              <p>{entry.notes || 'No notes'}</p>
            </div>
          ))
        ) : (
          <p className="helper-text">No call records yet.</p>
        )}
      </div>
    </article>
  );
}

export function CriterionRow({ criterion, onSave, onDelete }) {
  const [draft, setDraft] = useState({ title: criterion.title, description: criterion.description || '', order: criterion.order, isActive: criterion.isActive });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({ title: criterion.title, description: criterion.description || '', order: criterion.order, isActive: criterion.isActive });
  }, [criterion]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(criterion.id, draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><input type="number" min="1" value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })} /></td>
      <td><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></td>
      <td><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add description" /></td>
      <td><label className="inline-checkbox"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />{draft.isActive ? 'Active' : 'Inactive'}</label></td>
      <td className="actions">
        <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        <button type="button" className="secondary" onClick={() => onDelete(criterion.id)}>Delete</button>
      </td>
      <td>{error ? <span className="small-error">{error}</span> : null}</td>
    </tr>
  );
}
