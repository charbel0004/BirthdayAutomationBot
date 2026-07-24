import { useEffect, useMemo, useState } from 'react';
import { BloodDriveIcon, CallCenterRecordPanel, DonorProspectOverlay, DonorRepositoryCard, DonorRow, MetricBarChart, ModuleCard } from '../components/common';

export function BloodDrivePage({ donorStats, publicFormUrl, onOpenCollection, onOpenEligibleDonors, onOpenRepository, onOpenLocations, onExportDonations, onBack, isAdmin }) {
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Blood Drive Operations</h2>
          <p>Collect donor data, review eligibility, and monitor donor coverage across locations.</p>
        </div>
      </div>
      <section className="module-grid blood-drive-module-grid">
        <ModuleCard title="Blood Drive Data Collection" description="Open the donor form and submit a blood donor record." icon={<BloodDriveIcon />} onClick={onOpenCollection} />
        <ModuleCard title="Eligible Donor Call Center" description="Open the follow-up page for eligible donors and track contact outcomes." icon={<div className="module-icon-text">A+</div>} onClick={onOpenEligibleDonors} />
        <ModuleCard title="Donor Records" description="Review all donor records and manage follow-up details." icon={<div className="module-icon-text">🗂</div>} onClick={onOpenRepository} />
        {isAdmin ? <ModuleCard title="Donation Locations" description="Add locations and control which collection-day places stay active in the dropdown." icon={<div className="module-icon-text">📍</div>} onClick={onOpenLocations} /> : null}
      </section>
      <section className="panel">
        <h2>Blood Drive Insights</h2>
        <div className="stats-row">
          <article className="stat-card"><span>Total donor records</span><strong>{donorStats.totals.total}</strong></article>
          <article className="stat-card"><span>Eligible now</span><strong>{donorStats.totals.eligible}</strong></article>
          <article className="stat-card"><span>Upcoming donors</span><strong>{donorStats.totals.upcoming}</strong></article>
        </div>
        <div className="export-strip">
          <div>
            <h3>Public donor registration form</h3>
            <p>Use this link in your QR code so interested participants can submit their details for future blood donation campaigns.</p>
          </div>
          <div className="recruitment-link-card">
            <strong>{publicFormUrl}</strong>
          </div>
        </div>
        <div className="chart-grid">
          <MetricBarChart title="Donations by location" items={donorStats.byLocation.length ? donorStats.byLocation : [{ label: 'No data', value: 0 }]} />
          <MetricBarChart title="Donors by age group" items={donorStats.byAgeGroup.length ? donorStats.byAgeGroup : [{ label: 'No data', value: 0 }]} />
        </div>
        {isAdmin ? (
          <div className="export-strip">
            <div>
              <h3>Donation export</h3>
              <p>Download an Excel-compatible file for everyone who donated on a selected date.</p>
            </div>
            <form
              className="export-form"
              onSubmit={(event) => {
                event.preventDefault();
                onExportDonations(exportDate);
              }}
            >
              <input type="date" value={exportDate} onChange={(event) => setExportDate(event.target.value)} required />
              <button type="submit">Export Excel</button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function DonationLocationsPage({ locations, draft, setDraft, onCreateLocation, onToggleLocation, onBack }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Donation Locations</h2>
          <p>Manage which collection-day places are available in the active location dropdown.</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Active location controls</h2>
            <p>Add a place once, then activate or disable it as needed for each blood drive period.</p>
          </div>
        </div>
        <form className="filter-form location-form" onSubmit={onCreateLocation}>
          <label>
            <span>Location name</span>
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Add a donation location" required />
          </label>
          <button type="submit">Add Location</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {locations.length ? locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.name}</td>
                  <td>{location.active ? 'Active' : 'Disabled'}</td>
                  <td>{location.updatedAt ? new Date(location.updatedAt).toLocaleString('en-GB') : '—'}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => onToggleLocation(location)}>
                      {location.active ? 'Disable' : 'Activate'}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4">
                    <div className="repository-empty-state">
                      <strong>No donation locations yet.</strong>
                      <span>Add your first place to enable location selection in blood-drive collection.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function BloodDonorsRepositoryPage({ donors, filters, setFilters, draft, setDraft, error, onSearch, onCreateDonor, onSaveDonor, onDeleteDonor, onBack, isAdmin }) {
  const [addOverlayOpen, setAddOverlayOpen] = useState(false);
  const donatedCount = donors.filter((donor) => Boolean(donor.lastDonationDate)).length;
  const withLocationCount = donors.filter((donor) => Boolean(donor.location)).length;
  const eligibleCount = donors.filter((donor) => {
    if (!donor.nextEligibleDonationDate) return false;
    return donor.nextEligibleDonationDate <= new Date().toISOString().slice(0, 10);
  }).length;

  const handleCreateDonor = async (event) => {
    const success = await onCreateDonor(event);
    if (success) {
      setAddOverlayOpen(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearch();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [filters.name, filters.location, onSearch]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Blood Donors Repository</h2>
          <p>Add interested donors for future follow-up, review the repository, and reuse existing records during collection day.</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>All Donor Records</h2>
            <p>See both previous donors and interested donors collected for future call-center follow-up.</p>
          </div>
          <button type="button" onClick={() => setAddOverlayOpen(true)}>Add Interested Donor</button>
        </div>
        <div className="repository-summary-grid">
          <article className="repository-summary-card">
            <span>Total records</span>
            <strong>{donors.length}</strong>
          </article>
          <article className="repository-summary-card">
            <span>Recorded donations</span>
            <strong>{donatedCount}</strong>
          </article>
          <article className="repository-summary-card">
            <span>With location</span>
            <strong>{withLocationCount}</strong>
          </article>
          <article className="repository-summary-card">
            <span>Eligible now</span>
            <strong>{eligibleCount}</strong>
          </article>
        </div>
        <form className="filter-form repository-filter-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Name</span>
            <input placeholder="Filter by donor name" value={filters.name} onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Location</span>
            <input placeholder="Filter by latest or past location" value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} />
          </label>
          <div className="repository-filter-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setFilters({ name: '', location: '' });
              }}
            >
              Clear
            </button>
          </div>
        </form>
        <div className="table-wrap repository-table-wrap">
          <table className="repository-table">
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Age</th>
                <th>Date of birth</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Latest location</th>
                <th>Last donation</th>
                <th>Last update</th>
                <th>Updated by</th>
                <th>Next eligible</th>
              </tr>
            </thead>
            <tbody>
              {donors.length ? donors.map((donor) => (
                <DonorRow key={donor.id} donor={donor} onSave={onSaveDonor} onDelete={onDeleteDonor} editable={isAdmin} />
              )) : (
                <tr>
                  <td colSpan="11">
                    <div className="repository-empty-state">
                      <strong>No donor records found.</strong>
                      <span>Try broader filters or add an interested donor to start building the repository.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="repository-card-list">
          {donors.length ? donors.map((donor) => (
            <DonorRepositoryCard key={donor.id} donor={donor} />
          )) : (
            <div className="call-center-empty">No donor records found. Try broader filters or add an interested donor.</div>
          )}
        </div>
      </section>
      <DonorProspectOverlay
        isOpen={addOverlayOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setAddOverlayOpen(false)}
        onSubmit={handleCreateDonor}
        error={error}
      />
    </div>
  );
}

export function EligibleDonorsPage({ donorFilters, setDonorFilters, eligibleDonors, onSearch, onSaveDonor, onMarkDonated, onBack, isAdmin }) {
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const queueStats = useMemo(() => ({
    total: eligibleDonors.length,
    pending: eligibleDonors.filter((donor) => !donor.callStatus).length,
    noAnswer: eligibleDonors.filter((donor) => donor.callStatus === 'no-answer').length,
    upcoming: eligibleDonors.filter((donor) => donor.callStatus === 'upcoming').length,
    contactedToday: eligibleDonors.filter((donor) => donor.lastCallDate === today).length
  }), [eligibleDonors, today]);

  useEffect(() => {
    if (!eligibleDonors.some((donor) => donor.id === selectedDonorId)) {
      setSelectedDonorId('');
      setPanelOpen(false);
    }
  }, [eligibleDonors, selectedDonorId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearch();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [donorFilters.name, donorFilters.location, donorFilters.source, donorFilters.callStatus, onSearch]);

  const selectedDonor = eligibleDonors.find((donor) => donor.id === selectedDonorId) || null;

  return (
    <div className="page-shell call-center-page">
      <div className="page-header call-center-page-header">
        <div>
          <div className="panel-kicker">Blood Drive · Outreach Desk</div>
          <h2>Donor Call Center</h2>
          <p>Prioritize eligible donors, place calls, and record every outcome from one focused workspace.</p>
        </div>
        <div className="call-center-live-indicator"><span /> Live queue · {today}</div>
      </div>
      <section className="call-center-stat-grid" aria-label="Queue summary">
        <article><span>Eligible queue</span><strong>{queueStats.total}</strong><small>Ready for outreach</small></article>
        <article><span>Not contacted</span><strong>{queueStats.pending}</strong><small>First-call priority</small></article>
        <article><span>No answer</span><strong>{queueStats.noAnswer}</strong><small>Needs another attempt</small></article>
        <article><span>Upcoming</span><strong>{queueStats.upcoming}</strong><small>Interested donors</small></article>
        <article><span>Called today</span><strong>{queueStats.contactedToday}</strong><small>Team activity</small></article>
      </section>
      <section className="panel call-center-workspace">
        <div className="call-center-toolbar">
          <div>
            <div className="panel-kicker">Outreach queue</div>
            <h2>{eligibleDonors.length} donor{eligibleDonors.length === 1 ? '' : 's'} ready to contact</h2>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => setDonorFilters({ name: '', location: '', source: '', callStatus: '' })}
          >
            Clear filters
          </button>
        </div>
        <form className="call-center-filter-bar" onSubmit={(event) => event.preventDefault()}>
          <label className="call-center-search-field">
            <span>Search donor</span>
            <input placeholder="Name" value={donorFilters.name} onChange={(event) => setDonorFilters((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Call status</span>
            <select value={donorFilters.callStatus || ''} onChange={(event) => setDonorFilters((current) => ({ ...current, callStatus: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="pending">Not contacted</option>
              <option value="no-answer">No answer</option>
              <option value="upcoming">Upcoming</option>
              <option value="not-willing">Not willing</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <input placeholder="Event, referral..." value={donorFilters.source || ''} onChange={(event) => setDonorFilters((current) => ({ ...current, source: event.target.value }))} />
          </label>
          <label>
            <span>Location</span>
            <input placeholder="Any location" value={donorFilters.location} onChange={(event) => setDonorFilters((current) => ({ ...current, location: event.target.value }))} />
          </label>
        </form>
        <div className="call-center-layout">
          <div className="call-center-list">
            {eligibleDonors.length ? (
              eligibleDonors.map((donor, index) => {
                const statusLabels = {
                  upcoming: 'Upcoming',
                  'not-willing': 'Not willing',
                  'no-answer': 'No answer'
                };
                const status = donor.callStatus || 'pending';
                return (
                <div key={donor.id} className="call-center-list-item">
                  <button
                    type="button"
                    className={`call-center-donor-button${donor.id === selectedDonorId && panelOpen ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedDonorId(donor.id);
                      setPanelOpen(true);
                    }}
                  >
                    <span className="call-center-queue-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="call-center-donor-summary">
                      <strong>{donor.fullName}</strong>
                      <span>{donor.phoneNumber || 'No phone number'} · {donor.sourceOfContact || 'Source not recorded'}</span>
                    </span>
                    <span className={`call-status-pill status-${status}`}>{statusLabels[donor.callStatus] || 'Not contacted'}</span>
                  </button>
                  {donor.id === selectedDonorId && panelOpen ? (
                    <div className="call-center-inline-detail">
                      <CallCenterRecordPanel
                        donor={donor}
                        onSave={onSaveDonor}
                        onMarkDonated={onMarkDonated}
                        editable={isAdmin}
                        isOpen={panelOpen}
                        onClose={() => setPanelOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>
              );})
            ) : (
              <div className="call-center-empty call-center-queue-empty"><strong>No donors match these filters.</strong><span>Clear or broaden the filters to return to the outreach queue.</span></div>
            )}
          </div>
          <div className="call-center-detail">
            {selectedDonor && panelOpen ? (
              <CallCenterRecordPanel
                donor={selectedDonor}
                onSave={onSaveDonor}
                onMarkDonated={onMarkDonated}
                editable={isAdmin}
                isOpen={panelOpen}
                onClose={() => setPanelOpen(false)}
              />
            ) : (
              <div className="call-center-empty call-center-welcome">
                <span className="call-center-welcome-icon">☎</span>
                <strong>Select the next donor</strong>
                <span>Open a record to see the contact source, call the donor, record the outcome, and review previous attempts.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
