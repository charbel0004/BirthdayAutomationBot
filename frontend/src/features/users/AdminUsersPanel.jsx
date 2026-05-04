import { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserRow } from '../../components/common';
import { createDefaultModuleAccess, moduleAccessKeys, moduleAccessLabels } from '../../lib/state';

export default function AdminUsersPanel({ users, draft, setDraft, onCreate, onSave }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [search, setSearch] = useState('');

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

  const submitCreate = async (event) => {
    const success = await onCreate(event);
    if (success) {
      setOverlayOpen(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = normalizedSearch
    ? users.filter((user) => {
        const haystack = `${user.username} ${user.displayName} ${user.role}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : users;

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Users & Roles</h2>
          <p>Create admins, members, or new recruits and manage access to the central dashboard.</p>
        </div>
        <button type="button" onClick={() => setOverlayOpen(true)}>Create User</button>
      </div>
      <form className="filter-form user-search-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Search users</span>
          <input
            placeholder="Search by username, display name, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
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
            {filteredUsers.length ? filteredUsers.map((user) => (
              <UserRow key={user.id} user={user} onSave={onSave} />
            )) : (
              <tr>
                <td colSpan="5">
                  <div className="repository-empty-state">
                    <strong>No users found.</strong>
                    <span>Try a different username, display name, or role.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {overlayOpen ? createPortal(
        <div className="modal-backdrop modal-backdrop-top" onClick={() => setOverlayOpen(false)}>
          <div className="modal-card user-create-overlay" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Create User</h2>
                <p>Create the account and define its section access before the first login.</p>
              </div>
              <button type="button" className="secondary" onClick={() => setOverlayOpen(false)}>Close</button>
            </div>
            <form className="grid-form" onSubmit={submitCreate}>
              <label>
                Username
                <input
                  placeholder="Username"
                  value={draft.username}
                  onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                  required
                />
              </label>
              <label>
                Display name
                <input
                  placeholder="Display name"
                  value={draft.displayName}
                  onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                  required
                />
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  placeholder="Temporary password"
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={draft.role}
                  onChange={(event) => updateRole(event.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="new recruit">New Recruit</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="module-access-editor">
                <span>Section access</span>
                <div className="module-access-switches">
                  {moduleAccessKeys.map((key) => (
                    <label key={key} className="switch-row">
                      <div>
                        <strong>{moduleAccessLabels[key]}</strong>
                        <span>{draft.role === 'admin' ? 'Always enabled for admin accounts.' : `Allow access to ${moduleAccessLabels[key]}.`}</span>
                      </div>
                      <span className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={draft.role === 'admin' ? true : Boolean(draft.moduleAccess?.[key])}
                          disabled={draft.role === 'admin'}
                          onChange={(event) => toggleModuleAccess(key, event.target.checked)}
                        />
                        <span className="switch-slider" />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="switch-row">
                <div>
                  <strong>Active account</strong>
                  <span>Inactive users cannot log in until they are re-enabled.</span>
                </div>
                <span className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  />
                  <span className="switch-slider" />
                </span>
              </label>
              <button type="submit">Create User</button>
            </form>
          </div>
        </div>
      , document.body) : null}
    </section>
  );
}
