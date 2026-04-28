import { useEffect, useState } from 'react';
import { BloodDriveIcon, CallCenterRecordPanel, DonorProspectOverlay, DonorRepositoryCard, DonorRow, MetricBarChart, ModuleCard } from '../components/common';

export function BloodDrivePage({ donorStats, onOpenCollection, onOpenEligibleDonors, onOpenRepository, onBack }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Blood Drive Operations</h2>
          <p>Collect donor data, review eligibility, and monitor donor coverage across locations.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
      </div>
      <section className="module-grid">
        <ModuleCard title="Blood Drive Data Collection" description="Open the donor form and submit a blood donor record." icon={<BloodDriveIcon />} onClick={onOpenCollection} />
        <ModuleCard title="Eligible Donor Call Center" description="Open the follow-up page for eligible donors and track contact outcomes." icon={<div className="module-icon-text">A+</div>} onClick={onOpenEligibleDonors} />
        <ModuleCard title="Donors Repository" description="Open the complete donor repository and review donor records." icon={<div className="module-icon-text">🗂</div>} onClick={onOpenRepository} />
      </section>
      <section className="panel">
        <h2>Blood Drive Insights</h2>
        <div className="stats-row">
          <article className="stat-card"><span>Total donor records</span><strong>{donorStats.totals.total}</strong></article>
          <article className="stat-card"><span>Eligible now</span><strong>{donorStats.totals.eligible}</strong></article>
          <article className="stat-card"><span>Upcoming donors</span><strong>{donorStats.totals.upcoming}</strong></article>
        </div>
        <div className="chart-grid">
          <MetricBarChart title="Donors by location" items={donorStats.byLocation.length ? donorStats.byLocation : [{ label: 'No data', value: 0 }]} />
          <MetricBarChart title="Donors by age group" items={donorStats.byAgeGroup.length ? donorStats.byAgeGroup : [{ label: 'No data', value: 0 }]} />
        </div>
      </section>
    </div>
  );
}

export function BloodDonorsRepositoryPage({ donors, filters, setFilters, draft, setDraft, onSearch, onCreateDonor, onSaveDonor, onDeleteDonor, onBack, isAdmin }) {
  const [addOverlayOpen, setAddOverlayOpen] = useState(false);

  const handleCreateDonor = async (event) => {
    const success = await onCreateDonor(event);
    if (success) {
      setAddOverlayOpen(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Blood Donors Repository</h2>
          <p>Add interested donors for future follow-up, review the repository, and reuse existing records during collection day.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Blood Drive</button>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>All Donor Records</h2>
            <p>See both previous donors and interested donors collected for future call-center follow-up.</p>
          </div>
          <button type="button" onClick={() => setAddOverlayOpen(true)}>Add Interested Donor</button>
        </div>
        <form className="filter-form" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
          <input placeholder="Filter by name" value={filters.name} onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} />
          <input placeholder="Filter by location" value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} />
          <button type="submit">Apply Filters</button>
        </form>
        <div className="table-wrap repository-table-wrap">
          <table>
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Age</th>
                <th>Date of birth</th>
                <th>Phone</th>
                <th>Latest location</th>
                <th>All locations</th>
                <th>Last donation</th>
                <th>Last update</th>
                <th>Updated by</th>
                <th>Next eligible</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <DonorRow key={donor.id} donor={donor} onSave={onSaveDonor} onDelete={onDeleteDonor} editable={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="repository-card-list">
          {donors.length ? donors.map((donor) => (
            <DonorRepositoryCard key={donor.id} donor={donor} />
          )) : (
            <div className="call-center-empty">No donor records found.</div>
          )}
        </div>
      </section>
      <DonorProspectOverlay
        isOpen={addOverlayOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setAddOverlayOpen(false)}
        onSubmit={handleCreateDonor}
      />
    </div>
  );
}

export function EligibleDonorsPage({ donorFilters, setDonorFilters, eligibleDonors, onSearch, onSaveDonor, onMarkDonated, onBack, isAdmin }) {
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!eligibleDonors.some((donor) => donor.id === selectedDonorId)) {
      setSelectedDonorId('');
      setPanelOpen(false);
    }
  }, [eligibleDonors, selectedDonorId]);

  const selectedDonor = eligibleDonors.find((donor) => donor.id === selectedDonorId) || null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Blood Drive</div>
          <h2>Eligible Donor Call Center</h2>
          <p>Work through eligible donors, capture contact status, and record willingness to donate.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Blood Drive</button>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Call Center Queue</h2>
            <p>Only eligible donors appear here, including repository-added donors who have not donated yet.</p>
          </div>
        </div>
        <div className="call-center-guide">
          <span><strong>{eligibleDonors.length}</strong> eligible donors in queue</span>
          <span>Click a donor to open the side panel, update the current call, and review recent call history.</span>
        </div>
        <form className="filter-form" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
          <input placeholder="Filter by name" value={donorFilters.name} onChange={(event) => setDonorFilters((current) => ({ ...current, name: event.target.value }))} />
          <input placeholder="Filter by location" value={donorFilters.location} onChange={(event) => setDonorFilters((current) => ({ ...current, location: event.target.value }))} />
          <button type="submit">Apply Filters</button>
        </form>
        <div className="call-center-layout">
          <div className="call-center-list">
            {eligibleDonors.length ? (
              eligibleDonors.map((donor) => (
                <button
                  key={donor.id}
                  type="button"
                  className={`call-center-donor-button${donor.id === selectedDonorId && panelOpen ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedDonorId(donor.id);
                    setPanelOpen(true);
                  }}
                >
                  <strong>{donor.fullName}</strong>
                  <span>{donor.phoneNumber || 'No phone number'}</span>
                </button>
              ))
            ) : (
              <div className="helper-text">No eligible donors found.</div>
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
              <div className="call-center-empty">Click a donor to edit the call-center record and view call history.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
