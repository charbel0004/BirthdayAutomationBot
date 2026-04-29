import { UserRow } from '../../components/common';
import { createDefaultModuleAccess, moduleAccessKeys, moduleAccessLabels } from '../../lib/state';

export default function AdminUsersPanel({ users, draft, setDraft, onCreate, onSave }) {
  const updateRole = (role) => {
    setDraft((current) => ({
      ...current,
      role,
      moduleAccess: createDefaultModuleAccess(role)
    }));
  };

  const toggleModuleAccess = (key, checked) => {
    setDraft((current) => ({
      ...current,
      moduleAccess: {
        ...current.moduleAccess,
        [key]: checked
      }
    }));
  };

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Users & Roles</h2>
          <p>Create admins, members, or new recruits and manage access to the central dashboard.</p>
        </div>
      </div>
      <form className="user-form" onSubmit={onCreate}>
        <input
          placeholder="Username"
          value={draft.username}
          onChange={(event) => setDraft({ ...draft, username: event.target.value })}
          required
        />
        <input
          placeholder="Display name"
          value={draft.displayName}
          onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Temporary password"
          value={draft.password}
          onChange={(event) => setDraft({ ...draft, password: event.target.value })}
          required
        />
        <select
          value={draft.role}
          onChange={(event) => updateRole(event.target.value)}
        >
          <option value="member">Member</option>
          <option value="new recruit">New Recruit</option>
          <option value="admin">Admin</option>
        </select>
        <div className="module-access-editor">
          <span>Section access</span>
          <div className="module-access-options">
            {moduleAccessKeys.map((key) => (
              <label key={key} className="inline-checkbox">
                <input
                  type="checkbox"
                  checked={draft.role === 'admin' ? true : Boolean(draft.moduleAccess?.[key])}
                  disabled={draft.role === 'admin'}
                  onChange={(event) => toggleModuleAccess(key, event.target.checked)}
                />
                {moduleAccessLabels[key]}
              </label>
            ))}
          </div>
        </div>
        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          Active
        </label>
        <button type="submit">Create User</button>
      </form>
      <div className="table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Display name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
