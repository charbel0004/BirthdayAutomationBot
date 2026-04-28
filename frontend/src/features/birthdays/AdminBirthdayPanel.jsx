import { BirthdatePicker, BirthdayRow } from '../../components/common';

export default function AdminBirthdayPanel({
  birthdays,
  users,
  draft,
  setDraft,
  onCreate,
  onSave,
  onDelete
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Birthday Records</h2>
          <p>Create and maintain birthday records used by the Telegram automation.</p>
        </div>
      </div>
      <form className="member-form" onSubmit={onCreate}>
        <input
          placeholder="Member name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          required
        />
        <select
          value={draft.userId}
          onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
        >
          <option value="">Not linked to a user</option>
          {users
            .filter((user) => user.role !== 'admin')
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
        </select>
        <BirthdatePicker
          value={draft.birthdate}
          onChange={(birthdate) => setDraft({ ...draft, birthdate })}
        />
        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          Active
        </label>
        <button type="submit">Save Birthday</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Birthday</th>
              <th>Display</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Actions</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {birthdays.map((entry) => (
              <BirthdayRow
                key={entry.id}
                entry={entry}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
