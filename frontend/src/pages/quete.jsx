import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCompactDate, formatDateOnlyLabel, formatDateTime, formatTimeOnlyLabel } from '../lib/app';
import { MetricBarChart, ModuleCard, QueteIcon } from '../components/common';
import { pages } from '../lib/state';

const QUETE_TIMEZONE = 'Asia/Beirut';

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

function getMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthKey, amount) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  const date = new Date(year, (month || 1) - 1 + amount, 1);
  return getMonthKey(date);
}

function getShiftDateKey(shift) {
  return shift.date || toLocalDateInputValue(shift.startAt);
}

function getQueteTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUETE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getShiftAvailabilityStatus(shift, isReservedByCurrentUser) {
  const todayKey = getQueteTodayKey();
  const availableSeats = Math.max(0, Number(shift.availableSeats ?? (Number(shift.capacity || 0) - Number(shift.reservedCount || 0))));

  if (isReservedByCurrentUser) return 'reserved';
  if (shift.bookingOpensOn && shift.bookingOpensOn > todayKey) return 'upcoming';
  if (shift.bookingClosesOn && shift.bookingClosesOn < todayKey) return 'closed';
  if (availableSeats === 0) return 'full';
  if (availableSeats <= 2) return 'limited';
  return 'available';
}

function getShiftAvailabilityLabel(shift, status) {
  const availableSeats = Math.max(0, Number(shift.availableSeats ?? (Number(shift.capacity || 0) - Number(shift.reservedCount || 0))));
  if (status === 'reserved') return 'Reserved';
  if (status === 'upcoming') return 'Opens soon';
  if (status === 'closed') return 'Closed';
  if (status === 'full') return 'Full';
  return `${availableSeats} seat${availableSeats === 1 ? '' : 's'} left`;
}

function buildCalendarDays(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return [];

  const firstDay = new Date(year, month - 1, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: toLocalDateInputValue(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: toLocalDateInputValue(date) === toLocalDateInputValue(new Date())
    };
  });
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
  const todayKey = getQueteTodayKey();
  const reportedAvailableSeats = Number(shift.availableSeats);
  const calculatedAvailableSeats = Number(shift.capacity || 0) - Number(shift.reservedCount || 0);
  const availableSeats = Math.max(
    0,
    Number.isFinite(reportedAvailableSeats) ? reportedAvailableSeats : calculatedAvailableSeats
  );
  const isFullForNewUser = availableSeats === 0;
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
            <div className="repository-badge">{availableSeats} seat{availableSeats === 1 ? '' : 's'} left</div>
          )}
          {!showMemberManager ? (
            <button
              type="button"
              className="secondary quete-quick-action"
              disabled={isReserveDisabled}
              title={isFullForNewUser ? 'No seats are available for this shift.' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (isReserveDisabled) return;
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
        <button
          type="button"
          disabled={isReserveDisabled}
          title={isFullForNewUser ? 'No seats are available for this shift.' : undefined}
          onClick={() => {
            if (isReserveDisabled) return;
            onReserve(shift.id);
          }}
        >
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
      {!showMemberManager ? (
        <div className="table-wrap quete-table-wrap" style={{ marginTop: 16 }} onClick={(event) => event.stopPropagation()}>
          <table>
            <thead>
              <tr>
                <th>Reserved member</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {shift.reservations.length ? shift.reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.user?.displayName || 'Unknown user'}</td>
                  <td>{reservation.user?.role || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="2">
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

function QueteCalendarBoard({
  shifts,
  myShiftIds,
  canManage,
  showMemberManager,
  manageableUsers,
  assignmentDraft,
  onAssignmentChange,
  onReserve,
  onAssignUser,
  onRemoveReservation
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey());
  const [viewMode, setViewMode] = useState('calendar');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [filters, setFilters] = useState({ location: '', category: '', status: '' });
  const calendarDays = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const normalizedLocation = filters.location.trim().toLowerCase();
  const filteredMonthShifts = useMemo(
    () => shifts
      .filter((shift) => getShiftDateKey(shift).startsWith(selectedMonth))
      .filter((shift) => !normalizedLocation || String(shift.location || '').toLowerCase().includes(normalizedLocation))
      .filter((shift) => !filters.category || shift.shiftCategory === filters.category)
      .filter((shift) => {
        if (!filters.status) return true;
        const status = getShiftAvailabilityStatus(shift, myShiftIds.has(shift.id));
        if (filters.status === 'open') return status === 'available' || status === 'limited';
        return status === filters.status;
      })
      .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
    [shifts, selectedMonth, normalizedLocation, filters.category, filters.status, myShiftIds]
  );
  const shiftsByDate = useMemo(
    () => filteredMonthShifts.reduce((groups, shift) => {
      const dateKey = getShiftDateKey(shift);
      const bucket = groups.get(dateKey) || [];
      bucket.push(shift);
      groups.set(dateKey, bucket);
      return groups;
    }, new Map()),
    [filteredMonthShifts]
  );
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId) || null;
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(`${selectedMonth}-01T12:00:00`));
  const openCount = filteredMonthShifts.filter((shift) => {
    const status = getShiftAvailabilityStatus(shift, myShiftIds.has(shift.id));
    return status === 'available' || status === 'limited';
  }).length;

  useEffect(() => {
    if (!selectedShift) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedShiftId('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShift]);

  const renderShiftButton = (shift, compact = false) => {
    const status = getShiftAvailabilityStatus(shift, myShiftIds.has(shift.id));
    return (
      <button
        key={shift.id}
        type="button"
        className={`quete-calendar-shift is-${status}${compact ? ' is-compact' : ''}`}
        onClick={() => setSelectedShiftId(shift.id)}
        aria-label={`${shift.title}, ${formatTimeOnlyLabel(shift.startAt)}, ${getShiftAvailabilityLabel(shift, status)}`}
      >
        <span className="quete-calendar-shift-time">{formatTimeOnlyLabel(shift.startAt)}</span>
        <strong>{shift.title}</strong>
        <span className="quete-calendar-shift-status">{getShiftAvailabilityLabel(shift, status)}</span>
        {compact && shift.location ? <small>{shift.location}</small> : null}
      </button>
    );
  };

  return (
    <>
      <div className="quete-board-toolbar">
        <div className="quete-month-navigation" aria-label="Calendar month navigation">
          <button type="button" className="secondary quete-month-arrow" onClick={() => setSelectedMonth((month) => shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <div>
            <strong>{monthLabel}</strong>
            <span>{filteredMonthShifts.length} shifts · {openCount} open</span>
          </div>
          <button type="button" className="secondary quete-month-arrow" onClick={() => setSelectedMonth((month) => shiftMonth(month, 1))} aria-label="Next month">›</button>
          <button type="button" className="secondary quete-today-button" onClick={() => setSelectedMonth(getMonthKey())}>Today</button>
        </div>
        <div className="quete-view-toggle" aria-label="Shift board view">
          <button type="button" className={viewMode === 'calendar' ? 'is-active' : 'secondary'} onClick={() => setViewMode('calendar')} aria-pressed={viewMode === 'calendar'}>Calendar</button>
          <button type="button" className={viewMode === 'list' ? 'is-active' : 'secondary'} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}>List</button>
        </div>
      </div>

      <form className="quete-calendar-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Location</span>
          <input value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} placeholder="All locations" />
        </label>
        <label>
          <span>Category</span>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
            <option value="">All categories</option>
            <option value="road">Road</option>
            <option value="restaurant">Restaurant</option>
            <option value="church">Church</option>
            <option value="churchMass">Church Mass</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All shifts</option>
            <option value="open">Available</option>
            <option value="reserved">My shifts</option>
            <option value="full">Full</option>
            <option value="upcoming">Opens soon</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button type="button" className="secondary" onClick={() => setFilters({ location: '', category: '', status: '' })}>Clear filters</button>
      </form>

      <div className="quete-calendar-legend" aria-label="Shift status legend">
        <span className="is-available">Available</span>
        <span className="is-limited">Few seats</span>
        <span className="is-reserved">My shift</span>
        <span className="is-unavailable">Full / closed</span>
      </div>

      {viewMode === 'calendar' ? (
        <>
          <div className="quete-calendar-desktop">
            <div className="quete-calendar-weekdays" aria-hidden="true">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="quete-calendar-grid">
              {calendarDays.map((day) => (
                <section key={day.key} className={`quete-calendar-day${day.isCurrentMonth ? '' : ' is-outside'}${day.isToday ? ' is-today' : ''}`} aria-label={formatCompactDate(day.key)}>
                  <div className="quete-calendar-day-number">
                    <span>{day.dayNumber}</span>
                    {day.isToday ? <small>Today</small> : null}
                  </div>
                  <div className="quete-calendar-day-shifts">
                    {(shiftsByDate.get(day.key) || []).map((shift) => renderShiftButton(shift))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          {!filteredMonthShifts.length ? (
            <div className="repository-empty-state quete-calendar-empty-desktop">
              <strong>No shifts in {monthLabel}.</strong>
              <span>Choose another month or clear your filters.</span>
            </div>
          ) : null}
          <div className="quete-calendar-mobile-agenda">
            {Array.from(shiftsByDate.entries()).length ? Array.from(shiftsByDate.entries()).map(([dateKey, dateShifts]) => (
              <section key={dateKey} className="quete-agenda-day">
                <div className="quete-agenda-date">
                  <strong>{new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                  <span>{new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div>{dateShifts.map((shift) => renderShiftButton(shift, true))}</div>
              </section>
            )) : (
              <div className="repository-empty-state">
                <strong>No shifts in {monthLabel}.</strong>
                <span>Choose another month or clear your filters.</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="repository-card-list quete-shift-list quete-calendar-list-view">
          {filteredMonthShifts.length ? filteredMonthShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              isReservedByCurrentUser={myShiftIds.has(shift.id)}
              canManage={canManage}
              showMemberManager={showMemberManager}
              isOpen={selectedShiftId === shift.id}
              onToggle={() => setSelectedShiftId((current) => current === shift.id ? '' : shift.id)}
              manageableUsers={manageableUsers}
              assignmentDraft={assignmentDraft}
              onAssignmentChange={onAssignmentChange}
              onReserve={onReserve}
              onAssignUser={onAssignUser}
              onRemoveReservation={onRemoveReservation}
            />
          )) : (
            <div className="repository-empty-state">
              <strong>No shifts in {monthLabel}.</strong>
              <span>Choose another month or clear your filters.</span>
            </div>
          )}
        </div>
      )}

      {selectedShift && viewMode === 'calendar' ? createPortal(
        <div className="modal-backdrop quete-shift-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedShiftId('');
        }}>
          <div className="modal-card quete-shift-modal-card" role="dialog" aria-modal="true" aria-labelledby="quete-shift-dialog-title">
            <div className="modal-head">
              <div>
                <div className="panel-kicker">Shift details</div>
                <h2 id="quete-shift-dialog-title">{selectedShift.title}</h2>
              </div>
              <button type="button" className="secondary" onClick={() => setSelectedShiftId('')} aria-label="Close shift details">Close</button>
            </div>
            <ShiftCard
              shift={selectedShift}
              isReservedByCurrentUser={myShiftIds.has(selectedShift.id)}
              canManage={canManage}
              showMemberManager={showMemberManager}
              isOpen
              onToggle={() => {}}
              manageableUsers={manageableUsers}
              assignmentDraft={assignmentDraft}
              onAssignmentChange={onAssignmentChange}
              onReserve={onReserve}
              onAssignUser={onAssignUser}
              onRemoveReservation={onRemoveReservation}
            />
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function QuetePageLayout({ title, subtitle, data, canManage, showInsights, manageableUsers, assignmentDraft, onAssignmentChange, onReserve, onAssignUser, onRemoveReservation, onBack, children, showShiftList = true, showMemberManager = false }) {
  const myShiftIds = new Set((data.myReservations || []).map((item) => item.shift.id));
  const myParticipation = data.myParticipation || {};
  const calendarShifts = useMemo(() => {
    const uniqueShifts = new Map();
    (data.calendarShifts || data.shifts || []).forEach((shift) => uniqueShifts.set(shift.id, shift));
    (data.shifts || []).forEach((shift) => uniqueShifts.set(shift.id, shift));
    (data.myReservations || []).forEach((item) => {
      if (item.shift) uniqueShifts.set(item.shift.id, item.shift);
    });
    return Array.from(uniqueShifts.values());
  }, [data.calendarShifts, data.shifts, data.myReservations]);
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
    () => ((data.admin?.report || []).filter((entry) => entry.reservationsCount > 0).slice(0, 6).map((entry) => ({
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
        <section className="panel quete-calendar-panel">
          <div className="section-head">
            <div>
              <h2>Monthly shift calendar</h2>
              <p>See availability at a glance, then select a morning or afternoon shift to view its details.</p>
            </div>
          </div>
          <QueteCalendarBoard
            shifts={calendarShifts}
            myShiftIds={myShiftIds}
            canManage={canManage}
            showMemberManager={showMemberManager}
            manageableUsers={manageableUsers}
            assignmentDraft={assignmentDraft}
            onAssignmentChange={onAssignmentChange}
            onReserve={onReserve}
            onAssignUser={onAssignUser}
            onRemoveReservation={onRemoveReservation}
          />
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
        <ModuleCard
          title="Participation Report"
          description="Review participation, identify people with no shifts, and download monthly Excel reports."
          icon={<div className="module-icon-text">📊</div>}
          onClick={() => onNavigate(pages.queteReport)}
        />
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
      {data.myReservations.length ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>My reserved shifts</h2>
              <p>Your own Quete reservations are listed here as well.</p>
            </div>
          </div>
          <div className="repository-card-list quete-reservation-list">
            {data.myReservations.map((item) => (
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
          <input
            type="number"
            min="1"
            step="1"
            value={draft.capacity}
            onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))}
            required
          />
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
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const monthlyShifts = useMemo(() => {
    return (data.admin?.allShifts || data.shifts || [])
      .filter((shift) => String(shift.date || toLocalDateInputValue(shift.startAt)).startsWith(selectedMonth))
      .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  }, [data.admin?.allShifts, data.shifts, selectedMonth]);
  const monthlyTotals = useMemo(() => monthlyShifts.reduce((totals, shift) => ({
    capacity: totals.capacity + Number(shift.capacity || 0),
    reserved: totals.reserved + Number(shift.reservedCount || 0),
    available: totals.available + Number(shift.availableSeats || 0)
  }), { capacity: 0, reserved: 0, available: 0 }), [monthlyShifts]);
  const participationEntries = data.admin?.report || [];
  const noShiftCount = participationEntries.filter(
    (entry) => entry.user.role !== 'admin' && Number(entry.reservationsCount || 0) === 0
  ).length;

  return (
    <>
      <section className="panel quete-monthly-report">
        <div className="section-head quete-report-heading">
          <div>
            <div className="section-label">Monthly operations</div>
            <h2>All shifts & signups</h2>
            <p>Review every shift for one month, its capacity, open spots, and everyone who signed up.</p>
          </div>
          <div className="quete-report-actions">
            <label>
              <span>Report month</span>
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            </label>
            <button type="button" onClick={() => onExportReport(selectedMonth)} disabled={!selectedMonth}>
              Download Monthly Excel
            </button>
          </div>
        </div>
        <div className="stats-row quete-monthly-stats">
          <article className="stat-card"><span>Shifts</span><strong>{monthlyShifts.length}</strong></article>
          <article className="stat-card"><span>Total spots</span><strong>{monthlyTotals.capacity}</strong></article>
          <article className="stat-card"><span>Signed up</span><strong>{monthlyTotals.reserved}</strong></article>
          <article className="stat-card"><span>Open spots</span><strong>{monthlyTotals.available}</strong></article>
        </div>
        <div className="table-wrap quete-table-wrap quete-all-shifts-table">
          <table>
            <thead><tr><th>Date & shift</th><th>Location</th><th>Category</th><th>Spots</th><th>Signed</th><th>Available</th><th>Signed members</th></tr></thead>
            <tbody>
              {monthlyShifts.length ? monthlyShifts.map((shift) => {
                const signedMembers = (shift.reservations || []).map((reservation) => reservation.user?.displayName || 'Unknown member');
                return (
                  <tr key={shift.id}>
                    <td><strong>{shift.title}</strong><small>{formatDateOnlyLabel(shift.startAt)} · {formatTimeOnlyLabel(shift.startAt)}</small></td>
                    <td>{shift.location || '—'}</td>
                    <td>{getShiftCategoryLabel(shift.shiftCategory)}</td>
                    <td>{shift.capacity}</td>
                    <td>{shift.reservedCount}</td>
                    <td>{shift.availableSeats}</td>
                    <td>{signedMembers.length ? <div className="quete-member-chips">{signedMembers.map((name, index) => <span key={`${shift.id}-${index}`}>{name}</span>)}</div> : <span className="muted-table-value">No signups</span>}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7"><div className="repository-empty-state"><strong>No shifts in this month.</strong><span>Choose another month or create a shift for the selected period.</span></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div><div className="section-label">Team coverage</div><h2>All-time participation</h2><p>Everyone is included, including people who have not taken a shift yet.</p></div>
          <div className="participation-report-actions">
            <div className="report-zero-summary"><strong>{noShiftCount}</strong><span>No shifts yet</span></div>
            <button type="button" className="secondary" onClick={() => onExportReport('', 'non-participants')} disabled={noShiftCount === 0}>Download Non-Participants</button>
          </div>
        </div>
        <div className="table-wrap quete-table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Role</th><th>Road</th><th>Restaurant</th><th>Church</th><th>Church masses</th><th>Total shifts</th><th>Weighted total</th></tr></thead><tbody>
          {participationEntries.length ? participationEntries.map((entry) => {
            const hasNoShifts = Number(entry.reservationsCount || 0) === 0;
            return <tr key={entry.user.id} className={hasNoShifts ? 'participation-zero-row' : ''}><td>{entry.user.displayName}</td><td><span className={`participation-status ${hasNoShifts ? 'inactive' : 'active'}`}>{hasNoShifts ? 'No shifts yet' : 'Participated'}</span></td><td>{entry.user.role}</td><td>{entry.roadShifts}</td><td>{entry.restaurantShifts}</td><td>{entry.churchShifts}</td><td>{entry.churchMassShifts}</td><td>{entry.reservationsCount}</td><td>{entry.weightedTotal}</td></tr>;
          }) : <tr><td colSpan="9"><div className="repository-empty-state"><strong>No eligible users found.</strong><span>Active members and recruits will appear here.</span></div></td></tr>}
        </tbody></table></div>
      </section>
    </>
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

  if (isReportPage) {
    return (
      <QuetePageLayout
        title="Participation Report"
        subtitle="Review participation across the full team and export monthly reports to Excel."
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
