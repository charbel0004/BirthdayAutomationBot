import {
  BirthdayModuleCard,
  BloodDriveIcon,
  ModuleCard,
  PresentationModuleCard,
  QueteModuleCard
} from '../components/common';
import AdminBirthdayPanel from '../features/birthdays/AdminBirthdayPanel';
import TelegramSettingsPanel from '../features/settings/TelegramSettingsPanel';
import AdminUsersPanel from '../features/users/AdminUsersPanel';
import { formatDateOnlyLabel, formatTimeOnlyLabel } from '../lib/app';
import { hasModuleAccess, pages } from '../lib/state';

function AdminSummary({ summary }) {
  return (
    <>
      <section className="panel overview-panel">
        <div className="overview-copy">
          <h2>Central Overview</h2>
          <p>This workspace keeps birthdays, blood donor records, presentation data, and user access in MongoDB while Telegram settings stay in the existing JSON file.</p>
        </div>
        <div className="stats-row">
          <article className="stat-card"><span>Total users</span><strong>{summary.totalUsers}</strong></article>
          <article className="stat-card"><span>New recruits</span><strong>{summary.totalNewRecruits}</strong></article>
          <article className="stat-card"><span>Total birthdays</span><strong>{summary.totalBirthdays}</strong></article>
          <article className="stat-card"><span>Blood donor records</span><strong>{summary.totalBloodDonors}</strong></article>
          <article className="stat-card"><span>Quete shifts</span><strong>{summary.totalQueteShifts}</strong></article>
        </div>
      </section>
    </>
  );
}

export default function HomePage(props) {
  const {
    page,
    me,
    memberBirthday,
    presentationData,
    queteData,
    birthdays,
    users,
    settings,
    setSettings,
    newBirthday,
    setNewBirthday,
    newUser,
    setNewUser,
    onCreateBirthday,
    onUpdateBirthday,
    onDeleteBirthday,
    onCreateUser,
    onUpdateUser,
    onSaveSettings,
    onOpenBirthdayOverlay,
    onOpenBloodDrive,
    onOpenRecruitment,
    onOpenPresentations,
    onOpenQuete,
    onOpenAdminBirthdays,
    onOpenAdminUsers,
    onOpenAdminSettings,
    onBackToAdminHome
  } = props;

  const isAdmin = me.user.role === 'admin';
  const canAccessBloodDrive = hasModuleAccess(me.user, 'bloodDrive');
  const canAccessRecruitment = hasModuleAccess(me.user, 'recruitment');
  const canAccessPresentations = hasModuleAccess(me.user, 'presentations');
  const canAccessQuete = hasModuleAccess(me.user, 'quete');

  if (isAdmin && page === pages.adminBirthdays) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="panel-kicker">Admin</div>
            <h2>Birthday Records</h2>
            <p>Create, update, and remove birthday records without loading the rest of the admin tools on the same page.</p>
          </div>
          <button type="button" className="secondary" onClick={onBackToAdminHome}>Back to Admin Hub</button>
        </div>
        <AdminBirthdayPanel
          birthdays={birthdays}
          users={users}
          draft={newBirthday}
          setDraft={setNewBirthday}
          onCreate={onCreateBirthday}
          onSave={onUpdateBirthday}
          onDelete={onDeleteBirthday}
        />
      </div>
    );
  }

  if (isAdmin && page === pages.adminUsers) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="panel-kicker">Admin</div>
            <h2>Users & Roles</h2>
            <p>Create accounts, control module access, and update Quete focal permissions from one dedicated page.</p>
          </div>
          <button type="button" className="secondary" onClick={onBackToAdminHome}>Back to Admin Hub</button>
        </div>
        <AdminUsersPanel
          users={users}
          draft={newUser}
          setDraft={setNewUser}
          onCreate={onCreateUser}
          onSave={onUpdateUser}
        />
      </div>
    );
  }

  if (isAdmin && page === pages.adminSettings) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="panel-kicker">Admin</div>
            <h2>Telegram Settings</h2>
            <p>Adjust notification delivery settings on a separate page instead of keeping them open in the dashboard.</p>
          </div>
          <button type="button" className="secondary" onClick={onBackToAdminHome}>Back to Admin Hub</button>
        </div>
        <TelegramSettingsPanel
          settings={settings}
          setSettings={setSettings}
          onSave={onSaveSettings}
        />
      </div>
    );
  }

  return (
    <>
      <section className={`module-grid ${isAdmin ? 'admin-home-grid' : 'member-home-grid'}`.trim()}>
        {!isAdmin ? (
          <BirthdayModuleCard
            memberName={me.user.displayName || me.user.username}
            birthday={memberBirthday}
            onClick={onOpenBirthdayOverlay}
          />
        ) : null}
        {canAccessBloodDrive ? (
          <ModuleCard
            title="Blood Drive"
            description="Open donor collection, eligibility lists, and blood drive analytics."
            icon={<BloodDriveIcon />}
            onClick={onOpenBloodDrive}
          />
        ) : null}
        {canAccessRecruitment ? (
          <ModuleCard
            title="Recruitment"
            description="Open recruitment insights, the interested people repository, and the recruitment call center."
            icon={<div className="module-icon-text">☎</div>}
            onClick={onOpenRecruitment}
          />
        ) : null}
        {canAccessPresentations ? (
          <PresentationModuleCard
            role={me.user.role}
            recruitState={presentationData.recruit}
            onOpen={onOpenPresentations}
          />
        ) : null}
        {canAccessQuete ? (
          <QueteModuleCard
            shifts={queteData.shifts}
            myReservations={queteData.myReservations}
            onOpen={onOpenQuete}
          />
        ) : null}
      </section>

      {!isAdmin && canAccessQuete && queteData.myReservations.length ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>My Quete Shifts</h2>
              <p>Your reserved Quete shifts are shown here so you do not need to open the Quete page first.</p>
            </div>
          </div>
          <div className="repository-card-list quete-reservation-list" style={{ display: 'grid' }}>
            {queteData.myReservations.map((item) => (
              <article key={item.reservationId} className="repository-card">
                <div className="repository-card-head">
                  <div>
                    <h3>{item.shift.title}</h3>
                    <p>
                      {formatDateOnlyLabel(item.shift.startAt)} • {formatTimeOnlyLabel(item.shift.startAt)}
                      {item.shift.endAt ? ` to ${formatTimeOnlyLabel(item.shift.endAt)}` : ''}
                    </p>
                  </div>
                  <span className="repository-badge">Reserved</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <>
          <AdminSummary summary={me.summary} />
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Admin Tools</h2>
                <p>Open each admin area the same way you open other modules, then handle the detailed work inside that page.</p>
              </div>
            </div>
            <div className="module-grid blood-drive-module-grid admin-tools-module-grid">
              <ModuleCard
                title="Birthdays"
                description="Manage birthday records, activation state, and member birthday data on a dedicated page."
                icon={<div className="module-icon-text">🎂</div>}
                onClick={onOpenAdminBirthdays}
              />
              <ModuleCard
                title="Users & Roles"
                description="Create users, control access, and update internal permissions including Quete-related roles."
                icon={<div className="module-icon-text">👥</div>}
                onClick={onOpenAdminUsers}
              />
              <ModuleCard
                title="Telegram Settings"
                description="Configure delivery settings and operational notification behavior from its own admin page."
                icon={<div className="module-icon-text">✉</div>}
                onClick={onOpenAdminSettings}
              />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
