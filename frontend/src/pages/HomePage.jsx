import {
  BirthdayModuleCard,
  BloodDriveIcon,
  ModuleCard,
  PresentationModuleCard
} from '../components/common';
import AdminBirthdayPanel from '../features/birthdays/AdminBirthdayPanel';
import TelegramSettingsPanel from '../features/settings/TelegramSettingsPanel';
import AdminUsersPanel from '../features/users/AdminUsersPanel';
import { hasModuleAccess } from '../lib/state';

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
        </div>
      </section>
    </>
  );
}

export default function HomePage(props) {
  const {
    me,
    memberBirthday,
    presentationData,
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
    onOpenPresentations
  } = props;

  const isAdmin = me.user.role === 'admin';
  const canAccessBloodDrive = hasModuleAccess(me.user, 'bloodDrive');
  const canAccessRecruitment = hasModuleAccess(me.user, 'recruitment');
  const canAccessPresentations = hasModuleAccess(me.user, 'presentations');
  return (
    <>
      <section className={`module-grid ${isAdmin ? '' : 'member-home-grid'}`.trim()}>
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
      </section>

      {isAdmin ? (
        <>
          <AdminSummary summary={me.summary} />
          <AdminBirthdayPanel
            birthdays={birthdays}
            users={users}
            draft={newBirthday}
            setDraft={setNewBirthday}
            onCreate={onCreateBirthday}
            onSave={onUpdateBirthday}
            onDelete={onDeleteBirthday}
          />
          <AdminUsersPanel
            users={users}
            draft={newUser}
            setDraft={setNewUser}
            onCreate={onCreateUser}
            onSave={onUpdateUser}
          />
          <TelegramSettingsPanel
            settings={settings}
            setSettings={setSettings}
            onSave={onSaveSettings}
          />
        </>
      ) : null}
    </>
  );
}
