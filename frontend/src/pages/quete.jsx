import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCompactDate, formatDateOnlyLabel, formatDateTime, formatTimeOnlyLabel } from '../lib/app';
import { MetricBarChart, ModuleCard, QueteIcon } from '../components/common';
import { pages } from '../lib/state';

function getShiftCategoryLabel(category) {
  if (category === 'restaurant') return 'Restaurant';
  if (category === 'church') return 'Church';
  if (category === 'churchMass') return 'Church Mass';
  return 'Road';
}

function toLocalDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildShiftDraftFromShift(shift) {
  return {
    id: shift.id,
    title: shift.title || '',
    shiftType: shift.shiftType || 'morning',
    shiftCategory: shift.shiftCategory || 'road',
    date: shift.date || toLocalDateInputValue(shift.startAt),
    startAt: toLocalTimeInputValue(shift.startAt),
    endAt: toLocalTimeInputValue(shift.endAt),
    bookingOpensOn: shift.bookingOpensOn || '',
    bookingClosesOn: shift.bookingClosesOn || '',
    capacity: Number(shift.capacity || 1),
    location: shift.location || '',
    notes: shift.notes || ''
  };
}

function filterShiftsByDateAndLocation(shifts = [], filters = {}) {
  const normalizedDate = String(filters.date || '').trim();
  const normalizedLocation = String(filters.location || '').trim().toLowerCase();

  return shifts
    .filter((shift) => {
      const matchesDate = !normalizedDate || shift.date === normalizedDate || toLocalDateInputValue(shift.startAt) === normalizedDate;
      const matchesLocation = !normalizedLocation || String(shift.location || '').toLowerCase().includes(normalizedLocation);
      return matchesDate && matchesLocation;
    })
    .sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime());
}

function ShiftCard({
  shift,
  isReservedByCurrentUser,
  canManage,
  showMemberManager,
  isOpen,
  onToggle,
  manageableUsers,
  assignmentDraft,
  onAssignmentChange,
  onReserve,
  onAssignUser,
  onRemoveReservation
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const isFullForNewUser = shift.availableSeats <= 0;
  const isReservationUpcoming = Boolean(shift.bookingOpensOn) && shift.bookingOpensOn > todayKey;
  const isReservationClosed = Boolean(shift.bookingClosesOn) && shift.bookingClosesOn < todayKey;
  const isReserveDisabled = isFullForNewUser || isReservedByCurrentUser || isReservationUpcoming || isReservationClosed;
  const normalizedAssignmentQuery = (assignmentDraft[shift.id]?.query || '').trim().toLowerCase();
  const filteredAssignableUsers = normalizedAssignmentQuery
    ? manageableUsers.filter((user) => {
        const haystack = `${user.displayName} ${user.username} ${user.role}`.toLowerCase();
        return haystack.includes(normalizedAssignmentQuery);
      }).slice(0, 8)
    : [];

  return (
    <article className="panel quete-shift-card" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle();
      }
    }}>
      <div className="section-head quete-shift-head">
        <div>
          <div className="panel-kicker">Quete {shift.shiftType}</div>
          <h3>{shift.title}</h3>
          <p>
            {formatDateOnlyLabel(shift.startAt)}
            {' • '}
            {formatTimeOnlyLabel(shift.startAt)}
            {shift.endAt ? ` to ${formatTimeOnlyLabel(shift.endAt)}` : ''}
          </p>
        </div>
        <div className="quete-shift-head-actions">
          {isReservedByCurrentUser ? (
            <div className="repository-badge">Reserved</div>
          ) : isReservationUpcoming ? (
            <div className="repository-badge">Opens Soon</div>
          ) : isReservationClosed ? (
            <div className="repository-badge">Closed</div>
          ) : (
            <div className="repository-badge">{shift.availableSeats} seat{shift.availableSeats === 1 ? '' : 's'} left</div>
          )}
          {!showMemberManager ? (
            <button
              type="button"
              className="secondary quete-quick-action"
              disabled={isReserveDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onReserve(shift.id);
              }}
            >
              {isReservedByCurrentUser
                ? 'Reserved'
                : isReservationUpcoming
                  ? 'Opens Soon'
                  : isReservationClosed
                    ? 'Closed'
                    : isFullForNewUser
                      ? 'Full'
                      : 'Reserve My Seat'}
            </button>
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <>
      <div className="repository-card-grid" onClick={(event) => event.stopPropagation()}>
        <div className="repository-card-row"><span>Category</span><strong>{getShiftCategoryLabel(shift.shiftCategory)} ({shift.shiftValue})</strong></div>
        <div className="repository-card-row"><span>Booking opens on</span><strong>{shift.bookingOpensOn ? formatCompactDate(shift.bookingOpensOn) : '—'}</strong></div>
        <div className="repository-card-row"><span>Booking closes on</span><strong>{shift.bookingClosesOn ? formatCompactDate(shift.bookingClosesOn) : '—'}</strong></div>
        <div className="repository-card-row"><span>Location</span><strong>{shift.location || '—'}</strong></div>
        <div className="repository-card-row"><span>Needed members</span><strong>{shift.capacity}</strong></div>
        <div className="repository-card-row"><span>Reserved</span><strong>{shift.reservedCount}</strong></div>
        <div className="repository-card-row"><span>Notes</span><strong>{shift.notes || '—'}</strong></div>
      </div>
      <div className="actions" style={{ marginTop: 16 }} onClick={(event) => event.stopPropagation()}>
        <button type="button" disabled={isReserveDisabled} onClick={() => onReserve(shift.id)}>
          {isReservedByCurrentUser
            ? 'Already Reserved'
            : isReservationUpcoming
              ? 'Reservations Not Open'
              : isReservationClosed
                ? 'Reservations Closed'
                : isFullForNewUser
                  ? 'Full'
                  : 'Reserve My Seat'}
        </button>
      </div>
      {canManage && showMemberManager ? (
        <div className="table-wrap quete-table-wrap" style={{ marginTop: 16 }} onClick={(event) => event.stopPropagation()}>
          <table>
            <thead>
              <tr>
                <th>Reserved member</th>
                <th>Role</th>
                <th>Booked at</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shift.reservations.length ? shift.reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.user?.displayName || 'Unknown user'}</td>
                  <td>{reservation.user?.role || '—'}</td>
                  <td>{reservation.createdAt ? formatDateTime(reservation.createdAt) : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onRemoveReservation(shift.id, reservation.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4">
                    <div className="repository-empty-state">
                      <strong>No reservations yet.</strong>
                      <span>This shift still has open seats.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {canManage && showMemberManager ? (
        <>
          <form
            className="filter-form quete-assign-form"
            style={{ marginTop: 16 }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              onAssignUser(shift.id);
            }}
          >
            <label>
              <span>Add existing user</span>
              <input
                value={assignmentDraft[shift.id]?.query || ''}
                onChange={(event) => onAssignmentChange(shift.id, { query: event.target.value, userId: '' })}
                placeholder="Search members or recruits by name or username"
              />
            </label>
            <button type="submit" disabled={!assignmentDraft[shift.id]?.userId || isFullForNewUser}>Add to Shift</button>
          </form>
          {assignmentDraft[shift.id]?.query?.trim() ? (
            <div className="lookup-results" style={{ marginTop: 12 }} onClick={(event) => event.stopPropagation()}>
              {filteredAssignableUsers.length ? filteredAssignableUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`secondary lookup-result-button${assignmentDraft[shift.id]?.userId === user.id ? ' is-selected' : ''}`}
                  onClick={() => onAssignmentChange(shift.id, { userId: user.id, query: user.displayName })}
                >
                  {user.displayName} ({user.role})
                </button>
              )) : (
                <div className="repository-empty-state">
                  <strong>No matching users found.</strong>
                  <span>Search existing members or new recruits to add them to this shift.</span>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
        </>
      ) : null}
    </article>
  );
}

function QuetePageLayout({ title, subtitle, data, canManage, showInsights, manageableUsers, assignmentDraft, onAssignmentChange, onReserve, onAssignUser, onRemoveReservation, onBack, children, showShiftList = true, showMemberManager = false }) {
  const [openShiftId, setOpenShiftId] = useState('');
  const [filters, setFilters] = useState({ date: '', location: '' });
  const myShiftIds = new Set((data.myReservations || []).map((item) => item.shift.id));
  const myParticipation = data.myParticipation || {};
  const filteredShifts = useMemo(
    () => filterShiftsByDateAndLocation(data.shifts || [], filters),
    [data.shifts, filters]
  );
  const shiftMixItems = useMemo(() => ([
    { label: 'Road', value: data.stats.roadShifts || 0 },
    { label: 'Restaurant', value: data.stats.restaurantShifts || 0 },
    { label: 'Church', value: data.stats.churchShifts || 0 },
    { label: 'Church Mass', value: data.stats.churchMassShifts || 0 }
  ]), [data.stats]);
  const participantMixItems = useMemo(() => ([
    { label: 'Admins', value: data.stats.adminParticipants || 0 },
    { label: 'Members', value: data.stats.memberParticipants || 0 },
    { label: 'New recruits', value: data.stats.recruitParticipants || 0 }
  ]), [data.stats]);
  const topParticipantItems = useMemo(
    () => ((data.admin?.report || []).slice(0, 6).map((entry) => ({
      label: entry.user.displayName,
      value: entry.weightedTotal
    }))),
    [data.admin]
  );
  const memberShiftDistributionItems = useMemo(() => {
    const memberEntries = (data.admin?.report || []).filter((entry) => entry.user.role === 'member');
    return [
      { label: 'Road', value: memberEntries.reduce((sum, entry) => sum + Number(entry.roadShifts || 0), 0) },
      { label: 'Restaurant', value: memberEntries.reduce((sum, entry) => sum + Number(entry.restaurantShifts || 0), 0) },
      { label: 'Church', value: memberEntries.reduce((sum, entry) => sum + Number(entry.churchShifts || 0), 0) },
      { label: 'Church Mass', value: memberEntries.reduce((sum, entry) => sum + Number(entry.churchMassShifts || 0), 0) }
    ];
  }, [data.admin]);
  const recruitShiftDistributionItems = useMemo(() => {
    const recruitEntries = (data.admin?.report || []).filter((entry) => entry.user.role === 'new recruit');
    return [
      { label: 'Road', value: recruitEntries.reduce((sum, entry) => sum + Number(entry.roadShifts || 0), 0) },
      { label: 'Restaurant', value: recruitEntries.reduce((sum, entry) => sum + Number(entry.restaurantShifts || 0), 0) },
      { label: 'Church', value: recruitEntries.reduce((sum, entry) => sum + Number(entry.churchShifts || 0), 0) },
      { label: 'Church Mass', value: recruitEntries.reduce((sum, entry) => sum + Number(entry.churchMassShifts || 0), 0) }
    ];
  }, [data.admin]);

  return (
    <div className="page-shell quete-page">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Quete</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>My Quete total</h2>
            <p>Your running Quete participation count across all reserved shifts.</p>
          </div>
        </div>
        <div className="stats-row quete-stats-row">
          <article className="stat-card"><span>Total shifts taken</span><strong>{myParticipation.reservationsCount || 0}</strong></article>
        </div>
      </section>
      {showInsights ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Quete overview</h2>
              <p>Reserve available road-collection shifts and monitor remaining seats automatically.</p>
            </div>
            <div className="module-icon" style={{ width: 72, height: 72 }}><QueteIcon /></div>
          </div>
          <div className="stats-row quete-stats-row">
            <article className="stat-card"><span>Total shifts</span><strong>{data.stats.totalShifts}</strong></article>
            <article className="stat-card"><span>Open shifts</span><strong>{data.stats.openShifts}</strong></article>
            <article className="stat-card"><span>Total reservations</span><strong>{data.stats.totalReservations}</strong></article>
            <article className="stat-card"><span>Quete focals</span><strong>{data.stats.totalFocals}</strong></article>
            <article className="stat-card"><span>Road shifts</span><strong>{data.stats.roadShifts}</strong></article>
            <article className="stat-card"><span>Restaurant shifts</span><strong>{data.stats.restaurantShifts}</strong></article>
            <article className="stat-card"><span>Church shifts</span><strong>{data.stats.churchShifts}</strong></article>
            <article className="stat-card"><span>Church masses</span><strong>{data.stats.churchMassShifts}</strong></article>
            <article className="stat-card"><span>Total capacity</span><strong>{data.stats.totalCapacity}</strong></article>
            <article className="stat-card"><span>Filled seats</span><strong>{data.stats.filledSeats}</strong></article>
            <article className="stat-card"><span>Occupancy rate</span><strong>{data.stats.occupancyRate}%</strong></article>
            <article className="stat-card"><span>Unique participants</span><strong>{data.stats.uniqueParticipants}</strong></article>
            <article className="stat-card"><span>Admins joined</span><strong>{data.stats.adminParticipants}</strong></article>
            <article className="stat-card"><span>Members joined</span><strong>{data.stats.memberParticipants}</strong></article>
            <article className="stat-card"><span>New recruits joined</span><strong>{data.stats.recruitParticipants}</strong></article>
            <article className="stat-card"><span>Weighted shifts taken</span><strong>{data.stats.totalWeightedReservations}</strong></article>
          </div>
          <div className="chart-grid" style={{ marginTop: 16 }}>
            <MetricBarChart title="Shift Mix" items={shiftMixItems} />
            <MetricBarChart title="Participant Mix" items={participantMixItems} />
            <MetricBarChart
              title="Top Participation"
              items={topParticipantItems.length ? topParticipantItems : [{ label: 'No data', value: 0 }]}
            />
            <MetricBarChart
              title="Member Shift Distribution"
              items={memberShiftDistributionItems}
            />
            <MetricBarChart
              title="New Recruit Shift Distribution"
              items={recruitShiftDistributionItems}
            />
          </div>
        </section>
      ) : null}
      {children}
      {showShiftList ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Available shifts</h2>
              <p>Morning and afternoon capacity updates in real time as people are added or removed.</p>
            </div>
          </div>
          <form className="filter-form repository-filter-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={filters.date}
                onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
              />
            </label>
            <label>
              <span>Location</span>
              <input
                placeholder="Filter by location"
                value={filters.location}
                onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              />
            </label>
            <div className="repository-filter-actions">
              <button type="button" className="secondary" onClick={() => setFilters({ date: '', location: '' })}>Clear</button>
            </div>
          </form>
          <div className="repository-card-list quete-shift-list">
            {filteredShifts.length ? filteredShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                isReservedByCurrentUser={myShiftIds.has(shift.id)}
                canManage={canManage}
                showMemberManager={showMemberManager}
                isOpen={openShiftId === shift.id}
                onToggle={() => setOpenShiftId((current) => current === shift.id ? '' : shift.id)}
                manageableUsers={manageableUsers}
                assignmentDraft={assignmentDraft}
                onAssignmentChange={onAssignmentChange}
                onReserve={onReserve}
                onAssignUser={onAssignUser}
                onRemoveReservation={onRemoveReservation}
              />
            )) : (
              <div className="repository-empty-state">
                <strong>No matching quete shifts.</strong>
                <span>Try a different date or location filter.</span>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function MemberQuetePage({ data, assignmentDraft, onAssignmentChange, onReserve, onBack }) {
  return (
    <QuetePageLayout
      title="Quete Shifts"
      subtitle="Choose an available morning or afternoon shift and reserve your seat."
      data={data}
      canManage={false}
      showInsights={false}
      manageableUsers={[]}
      assignmentDraft={assignmentDraft}
      onAssignmentChange={onAssignmentChange}
      onReserve={onReserve}
      onAssignUser={() => {}}
      onRemoveReservation={() => {}}
      onBack={onBack}
    >
      {data.myReservations.length ? (
        <section className="panel">
          <h2>My reservations</h2>
          <div className="repository-card-list quete-reservation-list">
            {data.myReservations.map((item) => (
              <article key={item.reservationId} className="repository-card">
                <div className="repository-card-head">
                  <div>
                    <h3>{item.shift.title}</h3>
                    <p>{formatDateOnlyLabel(item.shift.startAt)} • {formatTimeOnlyLabel(item.shift.startAt)}{item.shift.endAt ? ` to ${formatTimeOnlyLabel(item.shift.endAt)}` : ''}</p>
                  </div>
                  <span className="repository-badge">Reserved</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </QuetePageLayout>
  );
}

function QueteManagerLandingPage({ isAdmin, data, onNavigate, onBack }) {
  return (
    <div className="page-shell quete-page">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Quete</div>
          <h2>Quete Operations</h2>
          <p>Open the exact Quete workspace you need first, then manage details inside that page.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
      </div>
      <section className="module-grid blood-drive-module-grid admin-tools-module-grid">
        <ModuleCard
          title="Shift Board"
          description="Open the live shift board to reserve seats and track shift availability without the heavier member-management controls."
          icon={<QueteIcon />}
          onClick={() => onNavigate(pages.queteBoard)}
        />
        <ModuleCard
          title="Shift Members Manager"
          description="Open a dedicated page to add people to shifts, remove people, and review the reserved list shift by shift."
          icon={<div className="module-icon-text">👥</div>}
          onClick={() => onNavigate(pages.queteMembers)}
        />
        <ModuleCard
          title="Shift Setup"
          description="Create new Quete shifts with date, booking window, time, category, and required capacity."
          icon={<div className="module-icon-text">🗓</div>}
          onClick={() => onNavigate(pages.queteShiftSetup)}
        />
        {isAdmin ? (
          <ModuleCard
            title="Participation Report"
            description="Review weighted participation totals and download the Excel report from a dedicated page."
            icon={<div className="module-icon-text">📊</div>}
            onClick={() => onNavigate(pages.queteReport)}
          />
        ) : null}
        {isAdmin ? (
          <ModuleCard
            title="Quete Focals"
            description="Search existing members and manage who can operate Quete shifts."
            icon={<div className="module-icon-text">🛡</div>}
            onClick={() => onNavigate(pages.queteFocals)}
          />
        ) : null}
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>My Quete total</h2>
            <p>Your running Quete participation count across all reserved shifts.</p>
          </div>
        </div>
        <div className="stats-row quete-stats-row">
          <article className="stat-card"><span>Total shifts taken</span><strong>{data.myParticipation?.reservationsCount || 0}</strong></article>
        </div>
      </section>
      {isAdmin ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Quete overview</h2>
              <p>Admin-only summary of the current Quete activity before opening a specific workspace.</p>
            </div>
            <div className="module-icon" style={{ width: 72, height: 72 }}><QueteIcon /></div>
          </div>
          <div className="stats-row quete-stats-row">
            <article className="stat-card"><span>Total shifts</span><strong>{data.stats.totalShifts}</strong></article>
            <article className="stat-card"><span>Open shifts</span><strong>{data.stats.openShifts}</strong></article>
            <article className="stat-card"><span>Total reservations</span><strong>{data.stats.totalReservations}</strong></article>
            <article className="stat-card"><span>Quete focals</span><strong>{data.stats.totalFocals}</strong></article>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QueteShiftSetupPanel({ draft, setDraft, shifts, onSaveShift, onStartEditShift, onCancelEditShift }) {
  const isEditing = Boolean(draft.id);
  const formRef = useRef(null);
  const titleInputRef = useRef(null);
  const [filters, setFilters] = useState({ date: '', location: '' });
  const filteredShifts = useMemo(
    () => filterShiftsByDateAndLocation(shifts, filters),
    [shifts, filters]
  );

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);
  }, [isEditing, draft.id]);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>{isEditing ? 'Edit quete shift' : 'Create quete shift'}</h2>
          <p>Define the date, booking window, time, category, and required number of people from one dedicated page.</p>
        </div>
        {isEditing ? <button type="button" className="secondary" onClick={onCancelEditShift}>Cancel Edit</button> : null}
      </div>
      <form ref={formRef} className="grid-form quete-create-form" onSubmit={onSaveShift}>
        <label>
          Title
          <input ref={titleInputRef} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Quete Jbeil Highway" />
        </label>
        <label>
          Shift type
          <select value={draft.shiftType} onChange={(event) => setDraft((current) => ({ ...current, shiftType: event.target.value }))}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </label>
        <label>
          Shift category
          <select value={draft.shiftCategory} onChange={(event) => setDraft((current) => ({ ...current, shiftCategory: event.target.value }))}>
            <option value="road">Road (1 shift)</option>
            <option value="restaurant">Restaurant (0.5 shift)</option>
            <option value="church">Church (1 shift)</option>
            <option value="churchMass">Church Mass (0.5 shift)</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required />
        </label>
        <label>
          Booking opens on
          <input type="date" value={draft.bookingOpensOn} onChange={(event) => setDraft((current) => ({ ...current, bookingOpensOn: event.target.value }))} required />
        </label>
        <label>
          Booking closes on
          <input type="date" value={draft.bookingClosesOn} onChange={(event) => setDraft((current) => ({ ...current, bookingClosesOn: event.target.value }))} required />
        </label>
        <label>
          Start time
          <input type="time" value={draft.startAt} onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))} required />
        </label>
        <label>
          End time
          <input type="time" value={draft.endAt} onChange={(event) => setDraft((current) => ({ ...current, endAt: event.target.value }))} />
        </label>
        <label>
          Needed members
          <input type="number" min="1" value={draft.capacity} onChange={(event) => setDraft((current) => ({ ...current, capacity: Number(event.target.value) || 1 }))} required />
        </label>
        <label>
          Location
          <input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} />
        </label>
        <label>
          Notes
          <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </label>
        <button type="submit">{isEditing ? 'Save Shift Changes' : 'Create Shift'}</button>
      </form>
      <form className="filter-form repository-filter-form" style={{ marginTop: 16 }} onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Date</span>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
          />
        </label>
        <label>
          <span>Location</span>
          <input
            placeholder="Filter by location"
            value={filters.location}
            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
          />
        </label>
        <div className="repository-filter-actions">
          <button type="button" className="secondary" onClick={() => setFilters({ date: '', location: '' })}>Clear</button>
        </div>
      </form>
      <div className="repository-card-list quete-focal-list" style={{ marginTop: 16 }}>
        {filteredShifts.length ? filteredShifts.map((shift) => (
          <article key={shift.id} className="repository-card">
            <div className="repository-card-head">
              <div>
                <h3>{shift.title}</h3>
                <p>
                  {formatDateOnlyLabel(shift.startAt)} • {formatTimeOnlyLabel(shift.startAt)}
                  {shift.endAt ? ` to ${formatTimeOnlyLabel(shift.endAt)}` : ''}
                </p>
              </div>
              <span className="repository-badge">{getShiftCategoryLabel(shift.shiftCategory)}</span>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => onStartEditShift(shift)}>
                Edit Shift
              </button>
            </div>
          </article>
        )) : (
          <div className="repository-empty-state">
            <strong>No matching shifts found.</strong>
            <span>Try a different date or location filter.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function QueteReportPanel({ data, onExportReport }) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Participation report</h2>
          <p>Weighted totals use road/church = 1 and restaurant/church mass = 0.5, matching the web report exactly.</p>
        </div>
        <button type="button" onClick={onExportReport}>Download Excel Report</button>
      </div>
      <div className="table-wrap quete-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Road shifts</th>
              <th>Restaurant shifts</th>
              <th>Church shifts</th>
              <th>Church masses</th>
              <th>Total shifts taken</th>
              <th>Weighted total</th>
            </tr>
          </thead>
          <tbody>
            {(data.admin?.report || []).length ? (data.admin.report || []).map((entry) => (
              <tr key={entry.user.id}>
                <td>{entry.user.displayName}</td>
                <td>{entry.user.role}</td>
                <td>{entry.roadShifts}</td>
                <td>{entry.restaurantShifts}</td>
                <td>{entry.churchShifts}</td>
                <td>{entry.churchMassShifts}</td>
                <td>{entry.reservationsCount}</td>
                <td>{entry.weightedTotal}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8">
                  <div className="repository-empty-state">
                    <strong>No participation recorded yet.</strong>
                    <span>Once users reserve quete shifts, their totals will appear here.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QueteFocalsPanel({ data, focalDraft, setFocalDraft, filteredFocalCandidates, onAddFocal, onRemoveFocal }) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Quete focals</h2>
          <p>Only admins can appoint or remove focal members who manage Quete reservations.</p>
        </div>
      </div>
      <form
        className="filter-form quete-focal-form"
        style={{ marginBottom: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          onAddFocal();
        }}
      >
        <label>
          <span>Add focal</span>
          <input
            value={focalDraft.query || ''}
            onChange={(event) => setFocalDraft((current) => ({ ...current, query: event.target.value, userId: '' }))}
            placeholder="Search existing members by name or username"
          />
        </label>
        <button type="submit" disabled={!focalDraft.userId}>Add Quete Focal</button>
      </form>
      {focalDraft.query?.trim() ? (
        <div className="lookup-results" style={{ marginBottom: 16 }}>
          {filteredFocalCandidates.length ? filteredFocalCandidates.map((user) => (
            <button
              key={user.id}
              type="button"
              className={`secondary lookup-result-button${focalDraft.userId === user.id ? ' is-selected' : ''}`}
              onClick={() => setFocalDraft({ userId: user.id, query: user.displayName })}
            >
              {user.displayName} ({user.username})
            </button>
          )) : (
            <div className="repository-empty-state">
              <strong>No matching members found.</strong>
              <span>Only existing member accounts can be assigned as quete focals.</span>
            </div>
          )}
        </div>
      ) : null}
      <div className="repository-card-list quete-focal-list">
        {data.focals.map((user) => (
          <article key={user.id} className="repository-card">
            <div className="repository-card-head">
              <div>
                <h3>{user.displayName}</h3>
                <p>{user.username}</p>
              </div>
              <span className="repository-badge">{user.role === 'admin' ? 'Admin' : 'Focal'}</span>
            </div>
            {user.role !== 'admin' ? (
              <div className="actions" style={{ marginTop: 12 }}>
                <button type="button" className="secondary" onClick={() => onRemoveFocal(user.id)}>
                  Remove Focal
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdminQuetePage({ page, me, data, draft, setDraft, focalDraft, setFocalDraft, assignmentDraft, onAssignmentChange, onSaveShift, onNavigate, onReserve, onAssignUser, onRemoveReservation, onAddFocal, onRemoveFocal, onExportReport, onBack, onResetShiftDraft }) {
  const isAdmin = me.user.role === 'admin';
  const manageableUsers = useMemo(
    () => (data.admin?.manageableUsers || []).filter((user) => user.moduleAccess?.quete),
    [data.admin]
  );
  const focalCandidates = useMemo(
    () => manageableUsers.filter((user) => user.role === 'member' && user.isQueteFocal !== true),
    [manageableUsers]
  );
  const normalizedFocalQuery = (focalDraft.query || '').trim().toLowerCase();
  const filteredFocalCandidates = useMemo(
    () => (
      normalizedFocalQuery
        ? focalCandidates.filter((user) => {
            const haystack = `${user.displayName} ${user.username}`.toLowerCase();
            return haystack.includes(normalizedFocalQuery);
          })
        : focalCandidates
    ).slice(0, 8),
    [focalCandidates, normalizedFocalQuery]
  );

  const isShiftSetupPage = page === pages.queteShiftSetup;
  const isMembersPage = page === pages.queteMembers;
  const isReportPage = page === pages.queteReport;
  const isFocalsPage = page === pages.queteFocals;
  const isBoardPage = page === pages.queteBoard;

  if (page === pages.quete) {
    return <QueteManagerLandingPage isAdmin={isAdmin} data={data} onNavigate={onNavigate} onBack={onBack} />;
  }

  if (isBoardPage) {
    return (
      <QuetePageLayout
        title="Shift Board"
        subtitle="Reserve seats and track live shift availability from a lighter board view."
        data={data}
        canManage={data.canManage}
        showInsights={false}
        manageableUsers={manageableUsers}
        assignmentDraft={assignmentDraft}
        onAssignmentChange={onAssignmentChange}
        onReserve={onReserve}
        onAssignUser={onAssignUser}
        onRemoveReservation={onRemoveReservation}
        onBack={() => onNavigate(pages.quete)}
        showMemberManager={false}
      />
    );
  }

  if (isMembersPage) {
    return (
      <QuetePageLayout
        title="Shift Members Manager"
        subtitle="Add people to shifts, remove them, and review reservation lists from one dedicated management page."
        data={data}
        canManage={data.canManage}
        showInsights={false}
        manageableUsers={manageableUsers}
        assignmentDraft={assignmentDraft}
        onAssignmentChange={onAssignmentChange}
        onReserve={onReserve}
        onAssignUser={onAssignUser}
        onRemoveReservation={onRemoveReservation}
        onBack={() => onNavigate(pages.quete)}
        showMemberManager
      />
    );
  }

  if (isShiftSetupPage) {
    return (
      <QuetePageLayout
        title="Shift Setup"
      subtitle="Create Quete shifts on a dedicated page, then go back to the main Quete page for live operations."
        data={data}
        canManage={data.canManage}
        showInsights={false}
        manageableUsers={manageableUsers}
        assignmentDraft={assignmentDraft}
        onAssignmentChange={onAssignmentChange}
        onReserve={onReserve}
        onAssignUser={onAssignUser}
        onRemoveReservation={onRemoveReservation}
        onBack={() => onNavigate(pages.quete)}
        showShiftList={false}
        showMemberManager={false}
      >
        <QueteShiftSetupPanel
          draft={draft}
          setDraft={setDraft}
          shifts={data.admin?.allShifts || data.shifts || []}
          onSaveShift={onSaveShift}
          onStartEditShift={(shift) => setDraft(buildShiftDraftFromShift(shift))}
          onCancelEditShift={onResetShiftDraft}
        />
      </QuetePageLayout>
    );
  }

  if (isAdmin && isReportPage) {
    return (
      <QuetePageLayout
        title="Participation Report"
        subtitle="Review weighted totals on a dedicated admin page and export the same report to Excel."
        data={data}
        canManage={data.canManage}
        showInsights={true}
        manageableUsers={manageableUsers}
        assignmentDraft={assignmentDraft}
        onAssignmentChange={onAssignmentChange}
        onReserve={onReserve}
        onAssignUser={onAssignUser}
        onRemoveReservation={onRemoveReservation}
        onBack={() => onNavigate(pages.quete)}
        showShiftList={false}
        showMemberManager={false}
      >
        <QueteReportPanel data={data} onExportReport={onExportReport} />
      </QuetePageLayout>
    );
  }

  if (isAdmin && isFocalsPage) {
    return (
      <QuetePageLayout
        title="Quete Focals"
        subtitle="Manage focal permissions on a separate page reserved for admins."
        data={data}
        canManage={data.canManage}
        showInsights={false}
        manageableUsers={manageableUsers}
        assignmentDraft={assignmentDraft}
        onAssignmentChange={onAssignmentChange}
        onReserve={onReserve}
        onAssignUser={onAssignUser}
        onRemoveReservation={onRemoveReservation}
        onBack={() => onNavigate(pages.quete)}
        showShiftList={false}
        showMemberManager={false}
      >
        <QueteFocalsPanel
          data={data}
          focalDraft={focalDraft}
          setFocalDraft={setFocalDraft}
          filteredFocalCandidates={filteredFocalCandidates}
          onAddFocal={onAddFocal}
          onRemoveFocal={onRemoveFocal}
        />
      </QuetePageLayout>
    );
  }

  return (
    <QuetePageLayout
      title="Shift Board"
      subtitle="Reserve seats and track live shift availability from a lighter board view."
      data={data}
      canManage={data.canManage}
      showInsights={false}
      manageableUsers={manageableUsers}
      assignmentDraft={assignmentDraft}
      onAssignmentChange={onAssignmentChange}
      onReserve={onReserve}
      onAssignUser={onAssignUser}
      onRemoveReservation={onRemoveReservation}
      onBack={onBack}
      showMemberManager={false}
    />
  );
}
