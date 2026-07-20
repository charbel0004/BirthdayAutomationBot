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
  const stats = [
    { label: 'Team members', value: summary.totalUsers, tone: 'red' },
    { label: 'New recruits', value: summary.totalNewRecruits, tone: 'blue' },
    { label: 'Birthdays tracked', value: summary.totalBirthdays, tone: 'amber' },
    { label: 'Donor records', value: summary.totalBloodDonors, tone: 'green' },
    { label: 'Quete shifts', value: summary.totalQueteShifts, tone: 'violet' }
  ];

  return (
    <section className="overview-metrics" aria-label="Workspace overview">
      {stats.map((stat) => (
        <article className={`overview-metric metric-${stat.tone}`} key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value ?? 0}</strong>
          <i aria-hidden="true" />
        </article>
      ))}
    </section>
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
    logisticsItems,
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
    onOpenCertificateGenerator,
    onOpenAdminBirthdays,
    onOpenAdminUsers,
    onOpenAdminSettings,
    onOpenLogistics,
    onBackToAdminHome
  } = props;

  const isAdmin = me.user.role === 'admin';
  const canAccessBloodDrive = hasModuleAccess(me.user, 'bloodDrive');
  const canAccessRecruitment = hasModuleAccess(me.user, 'recruitment');
  const canAccessPresentations = hasModuleAccess(me.user, 'presentations');
  const canAccessQuete = hasModuleAccess(me.user, 'quete');
  const canAccessLogistics = hasModuleAccess(me.user, 'logistics');
  const canAccessCertificateGenerator = hasModuleAccess(me.user, 'certificateGenerator');

  if (isAdmin && page === pages.adminBirthdays) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="panel-kicker">Admin</div>
            <h2>Birthday Records</h2>
            <p>Create, update, and remove birthday records without loading the rest of the admin tools on the same page.</p>
          </div>
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
      <section className="home-page-overview">
        <div>
          <div className="panel-kicker">{isAdmin ? 'Administration workspace' : 'Member workspace'}</div>
          <h2>{isAdmin ? 'Operations Overview' : `Welcome, ${me.user.displayName || me.user.username}`}</h2>
          <p>{isAdmin
            ? 'Monitor activity across the Youth Sector Hub, open operational modules, and manage the tools available to your teams.'
            : 'Access your available services, review your participation, and continue current Youth Sector activities.'}</p>
          <div className="overview-status-row" aria-label="Workspace status">
            <span><i className="status-dot" aria-hidden="true" />All systems ready</span>
            <span>{isAdmin ? `${me.summary?.totalUsers ?? 0} people in your workspace` : 'Your services are ready'}</span>
          </div>
        </div>
        <div className="overview-emblem" aria-hidden="true"><span /></div>
      </section>

      {isAdmin ? <AdminSummary summary={me.summary} /> : null}

      {canAccessLogistics && logisticsItems.some((item) => item.isLowStock) ? (
        <button type="button" className="home-logistics-alert" onClick={onOpenLogistics}>
          <span aria-hidden="true">!</span>
          <strong>{logisticsItems.filter((item) => item.isLowStock).length} logistics item{logisticsItems.filter((item) => item.isLowStock).length === 1 ? '' : 's'} need reordering</strong>
          <small>Open inventory →</small>
        </button>
      ) : null}

      <div className="dashboard-section-heading">
        <div>
          <div className="section-label">Your workspace</div>
          <h2>Services & operations</h2>
          <p>Everything you have access to, organized in one place.</p>
        </div>
      </div>
      <section className={`module-grid ${isAdmin ? 'admin-home-grid' : 'member-home-grid'}`.trim()}>
        {!isAdmin ? (
          <BirthdayModuleCard
            memberName={me.user.displayName || me.user.username}
            birthday={memberBirthday}
            onClick={onOpenBirthdayOverlay}
          />
        ) : null}
        {!isAdmin && canAccessLogistics ? (
          <ModuleCard
            title="Logistics Inventory"
            description="Track stock quantities, package sizes, and items that have reached their reorder point."
            icon={<div className="module-icon-text">📦</div>}
            onClick={onOpenLogistics}
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
        {canAccessCertificateGenerator ? (
          <ModuleCard
            title="Certificate Generator"
            description="Upload an Excel participant list and download the completed certificate PDF."
            icon={<div className="module-icon-text">🏅</div>}
            onClick={onOpenCertificateGenerator}
          />
        ) : null}
      </section>

      {!isAdmin && canAccessQuete && queteData.myReservations.length ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>My Quete Shifts</h2>
              <p>
                You have taken {queteData.myParticipation?.reservationsCount || 0} shift
                {(queteData.myParticipation?.reservationsCount || 0) === 1 ? '' : 's'} in total.
              </p>
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
          <section className="panel">
            <div className="section-head">
              <div>
                <div className="section-label">Administration</div>
                <h2>Workspace management</h2>
                <p>Manage people, birthday records, permissions, and notification delivery.</p>
              </div>
            </div>
            <div className="module-grid blood-drive-module-grid admin-tools-module-grid">
              <ModuleCard
                title="Logistics Inventory"
                description="Track stock, set reorder points, and manage website and Telegram low-stock reminders."
                icon={<div className="module-icon-text">📦</div>}
                onClick={onOpenLogistics}
              />
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
