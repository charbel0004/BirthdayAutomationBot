import { useEffect, useMemo, useState } from 'react';
import { formatCompactDate } from '../lib/app';
import { ModuleCard, RecruitmentCallCenterPanel, RecruitmentInterestOverlay } from '../components/common';

function buildRecruitmentStats(leads) {
  return {
    total: leads.length,
    newLeads: leads.filter((lead) => !lead.callStatus).length,
    followUps: leads.filter((lead) => ['follow-up', 'scheduled'].includes(lead.callStatus)).length,
    closed: leads.filter((lead) => ['not-interested', 'scheduled'].includes(lead.callStatus)).length
  };
}

export function RecruitmentPage({ leads, publicFormUrl, onOpenRepository, onOpenCallCenter, onBack }) {
  const stats = useMemo(() => buildRecruitmentStats(leads), [leads]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Recruitment</div>
          <h2>Recruitment Operations</h2>
          <p>Track interested people from the QR intake form, review the repository, and manage recruitment follow-up separately from blood drive.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
      </div>
      <section className="module-grid blood-drive-module-grid">
        <ModuleCard
          title="Interested People Repository"
          description="Review everyone who submitted the recruitment interest form and search the full recruitment pool."
          icon={<div className="module-icon-text">🗂</div>}
          onClick={onOpenRepository}
        />
        <ModuleCard
          title="Recruitment Call Center"
          description="Update outreach status, schedule follow-ups, and keep recruitment call history."
          icon={<div className="module-icon-text">☎</div>}
          onClick={onOpenCallCenter}
        />
      </section>
      <section className="panel">
        <h2>Recruitment Insights</h2>
        <div className="stats-row">
          <article className="stat-card"><span>Total interested people</span><strong>{stats.total}</strong></article>
          <article className="stat-card"><span>New submissions</span><strong>{stats.newLeads}</strong></article>
          <article className="stat-card"><span>Need follow-up</span><strong>{stats.followUps}</strong></article>
          <article className="stat-card"><span>Closed outcomes</span><strong>{stats.closed}</strong></article>
        </div>
        <div className="export-strip">
          <div>
            <h3>Public interest form</h3>
            <p>Use this link in your QR code so people can submit interest directly into the recruitment repository.</p>
          </div>
          <div className="recruitment-link-card">
            <strong>{publicFormUrl}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export function RecruitmentRepositoryPage({ filters, setFilters, leads, draft, setDraft, error, saving, onSearch, onCreateLead, onBack }) {
  const [addOverlayOpen, setAddOverlayOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearch();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filters.name, filters.status, onSearch]);

  const handleCreateLead = async (event) => {
    const success = await onCreateLead(event);
    if (success) {
      setAddOverlayOpen(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Recruitment</div>
          <h2>Interested People Repository</h2>
          <p>Keep the complete list of people who submitted the recruitment form before moving them through the call center.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Recruitment</button>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Recruitment Leads</h2>
            <p>This list stays separate from blood donors and only contains recruitment-interest submissions.</p>
          </div>
          <button type="button" onClick={() => setAddOverlayOpen(true)}>Add Interested Person</button>
        </div>
        <form className="filter-form repository-filter-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Name</span>
            <input
              placeholder="Filter by person name"
              value={filters.name}
              onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="follow-up">Needs follow-up</option>
              <option value="scheduled">Scheduled</option>
              <option value="not-interested">Not interested</option>
              <option value="no-answer">No answer</option>
            </select>
          </label>
          <div className="repository-filter-actions">
            <button type="button" className="secondary" onClick={() => setFilters({ name: '', status: '' })}>Clear</button>
          </div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Phone</th>
                <th>Date of birth</th>
                <th>Status</th>
                <th>Last call</th>
                <th>Follow-up</th>
                <th>Updated by</th>
              </tr>
            </thead>
            <tbody>
              {leads.length ? leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.firstName}</td>
                  <td>{lead.lastName}</td>
                  <td>{lead.phoneNumber || '—'}</td>
                  <td>{formatCompactDate(lead.dateOfBirth)}</td>
                  <td>{lead.callStatus || 'New'}</td>
                  <td>{lead.lastCallDate ? formatCompactDate(lead.lastCallDate) : '—'}</td>
                  <td>{lead.followUpDate ? formatCompactDate(lead.followUpDate) : '—'}</td>
                  <td>{lead.updatedByName || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">
                    <div className="repository-empty-state">
                      <strong>No recruitment leads found.</strong>
                      <span>Once people submit the QR form, they will appear here.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <RecruitmentInterestOverlay
        isOpen={addOverlayOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setAddOverlayOpen(false)}
        onSubmit={handleCreateLead}
        error={error}
        saving={saving}
      />
    </div>
  );
}

export function RecruitmentCallCenterPage({ filters, setFilters, leads, onSearch, onSaveLead, onBack, canManageRecruitment }) {
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!leads.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId('');
      setPanelOpen(false);
    }
  }, [leads, selectedLeadId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearch();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filters.name, filters.status, onSearch]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Recruitment</div>
          <h2>Recruitment Call Center</h2>
          <p>Call people who submitted interest through the QR form and keep a separate recruitment follow-up history.</p>
        </div>
        <button type="button" className="secondary" onClick={onBack}>Back to Recruitment</button>
      </div>
      <section className="panel">
        <div className="call-center-guide">
          <span><strong>{leads.length}</strong> recruitment leads in queue</span>
          <span>Click a lead to update the recruitment call result and save follow-up history.</span>
        </div>
        <form className="filter-form repository-filter-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Name</span>
            <input placeholder="Filter by name" value={filters.name} onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="follow-up">Needs follow-up</option>
              <option value="scheduled">Scheduled</option>
              <option value="not-interested">Not interested</option>
              <option value="no-answer">No answer</option>
            </select>
          </label>
        </form>
        <div className="call-center-layout">
          <div className="call-center-list">
            {leads.length ? leads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className={`call-center-donor-button${lead.id === selectedLeadId && panelOpen ? ' is-active' : ''}`}
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setPanelOpen(true);
                }}
              >
                <strong>{lead.fullName}</strong>
                <span>{lead.phoneNumber || 'No phone number'}{lead.callStatus ? ` · ${lead.callStatus}` : ' · New'}</span>
              </button>
            )) : (
              <div className="helper-text">No recruitment leads found.</div>
            )}
          </div>
          <div className="call-center-detail">
            {selectedLead && panelOpen ? (
              <RecruitmentCallCenterPanel
                lead={selectedLead}
                onSave={onSaveLead}
                editable={canManageRecruitment}
                isOpen={panelOpen}
                onClose={() => setPanelOpen(false)}
              />
            ) : (
              <div className="call-center-empty">Click a recruitment lead to edit the record and review call history.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
