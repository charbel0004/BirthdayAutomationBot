import { UserRow } from '../../components/common';

export default function AdminUsersPanel({ users, draft, setDraft, onCreate, onSave }) {
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
          onChange={(event) => setDraft({ ...draft, role: event.target.value })}
        >
          <option value="member">Member</option>
          <option value="new recruit">New Recruit</option>
          <option value="admin">Admin</option>
        </select>
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
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Display name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Reset password</th>
              <th>Actions</th>
              <th />
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
