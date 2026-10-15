import { useEffect, useState } from 'react';
import { api, downloadFile, uploadAssessmentWorkbook, formatDateTime } from '../lib/app';

export function ChallengeDetails({ topic, expanded = false }) {
  if (!topic) return null;
  const content = <div className="challenge-details-copy">
    <h3>{topic.challenge?.title || 'Presentation assignment'}</h3>
    <p>{topic.challenge?.description}</p>
    <div className="assignment-topic-brief"><span>Your topic</span><h4>{topic.title}</h4>{topic.description && <p className="preserve-lines">{topic.description}</p>}</div>
    <h4>Instructions & expectations</h4>
    <p className="preserve-lines">{topic.challenge?.instructions || 'Follow your assigned topic instructions.'}</p>
  </div>;
  return expanded ? content : <details className="challenge-details"><summary>{topic.challenge?.title || 'Challenge'} · {topic.title} — View instructions</summary>{content}</details>;
}

const emptyChallenge = { title: '', description: '', instructions: '', active: true };
const emptyTopic = { title: '', description: '', active: true };

export function ChallengeManagement({ token, onRefresh }) {
  const [list, setList] = useState([]), [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(emptyChallenge), [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => setList(await api('/api/assessments/challenges', { token }));
  useEffect(() => { load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [token]);
  async function run(action) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function edit(kind, record, challengeId) {
    setEditor({ kind, id: record?.id, challengeId });
    setDraft(record ? { ...record } : { ...(kind === 'challenge' ? emptyChallenge : emptyTopic) });
  }
  function save(event) {
    event.preventDefault();
    run(async () => {
      const path = editor.kind === 'challenge' ? `/challenges${editor.id ? `/${editor.id}` : ''}` : editor.id ? `/topics/${editor.id}` : `/challenges/${editor.challengeId}/topics`;
      await api(`/api/assessments${path}`, { token, method: editor.id ? 'PUT' : 'POST', body: draft });
      setEditor(null); await load(); await onRefresh(); setNotice('Saved successfully.');
    });
  }
  const remove = (path, label) => {
    if (!window.confirm(`Delete ${label}?`)) return;
    run(async () => { await api(`/api/assessments/${path}`, { token, method: 'DELETE' }); await load(); await onRefresh(); });
  };
  return <section className="panel assessment-management">
    <div className="section-head"><div><h2>Challenges & topics</h2><p>Each spin assigns one active topic and its challenge. Assigned instructions are preserved.</p></div><button disabled={busy} onClick={() => edit('challenge')}>New challenge</button></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {notice && <div className="notice-banner" role="status">{notice}</div>}
    <div className="catalog-overview"><div><strong>{list.length}</strong><span>Challenges</span></div><div><strong>{list.reduce((sum, item) => sum + item.topics.filter((topic) => item.active && topic.active && !topic.isAssigned).length, 0)}</strong><span>Topics available</span></div><div><strong>{list.reduce((sum, item) => sum + item.topics.filter((topic) => topic.isAssigned).length, 0)}</strong><span>Assigned topics</span></div></div>
    <details className="catalog-import"><summary>Import challenges from Excel</summary><p>Use the template to add multiple topics at once. Review the import before saving.</p><div className="assessment-toolbar">
      <button className="secondary" disabled={busy} onClick={() => run(() => downloadFile('/api/assessments/challenges-template', { token }))}>Download Excel template</button>
      <label className="assessment-upload">Import .xlsx (up to 500 topics)
        <input type="file" accept=".xlsx" disabled={busy} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''; setPreview(null);
          if (file) run(async () => setPreview(await uploadAssessmentWorkbook(file, token)));
        }} />
      </label>
    </div></details>
    {preview && <div className="assessment-import-preview">
      <h3>Import preview · {preview.challengeCount} challenges / {preview.topicCount} topics</h3>
      <p>Repeat the same challenge title, description and instructions for each of its topics.</p>
      {preview.errors.length > 0 && <ul role="alert">{preview.errors.map((message, index) => <li key={index}>{message}</li>)}</ul>}
      <div className="catalog-preview-groups">{[...new Set(preview.rows.map((row) => row.challengeTitle))].map((title) => { const group = preview.rows.filter((row) => row.challengeTitle === title); return <details className="challenge-manager-row" key={title}><summary><strong>{title}</strong><span>{group.length} topics</span></summary><p>{group[0].description}</p><details className="catalog-instructions"><summary>Challenge instructions</summary><p className="preserve-lines">{group[0].instructions}</p></details><div className="catalog-topic-grid">{group.map((row, index) => <article className="catalog-topic-card" key={index}><h4>{row.title}</h4><p>{row.topicDescription || 'Follow the challenge instructions.'}</p></article>)}</div></details>; })}</div>
      <div className="actions"><button disabled={busy || preview.errors.length > 0} onClick={() => run(async () => { await api('/api/assessments/import/confirm', { token, method: 'POST', body: { rows: preview.rows } }); setPreview(null); await load(); await onRefresh(); setNotice('Challenges and topics imported.'); })}>{busy ? 'Importing…' : 'Confirm import'}</button><button className="secondary" disabled={busy} onClick={() => setPreview(null)}>Cancel</button></div>
    </div>}
    {loading ? <p role="status">Loading challenges…</p> : !list.length ? <p>No challenges yet. Create one or import the completed template.</p> : list.map((challenge) => <details className="challenge-manager-row" key={challenge.id}>
      <summary><strong>{challenge.title}</strong><span className={`catalog-status ${challenge.active ? 'available' : ''}`}>{challenge.active ? 'Active' : 'Inactive'} · {challenge.topics.length} topics</span></summary>
      <p className="catalog-description">{challenge.description}</p><details className="catalog-instructions"><summary>Read challenge instructions</summary><p className="preserve-lines">{challenge.instructions}</p></details>
      <div className="actions"><button disabled={busy} className="secondary" onClick={() => edit('challenge', challenge)}>Edit challenge</button><button disabled={busy} className="secondary" onClick={() => run(async () => { await api(`/api/assessments/challenges/${challenge.id}`, { token, method: 'PUT', body: { ...challenge, active: !challenge.active } }); await load(); await onRefresh(); })}>{challenge.active ? 'Deactivate' : 'Activate'}</button><button disabled={busy || challenge.topics.length > 0} className="secondary" onClick={() => remove(`challenges/${challenge.id}`, challenge.title)}>Delete challenge</button><button disabled={busy} onClick={() => edit('topic', null, challenge.id)}>Add topic</button></div>
      <div className="catalog-topic-grid">{challenge.topics.map((topic, index) => <article className="catalog-topic-card" key={topic.id}><div className="catalog-topic-meta"><span>Topic {String(index + 1).padStart(2, '0')}</span><span className={`catalog-status ${!topic.isAssigned && topic.active && challenge.active ? 'available' : ''}`}>{topic.isAssigned ? 'Assigned · Locked' : !topic.active ? 'Inactive' : !challenge.active ? 'Challenge inactive' : 'Available'}</span></div><h4>{topic.title}</h4><p>{topic.description || 'Follow the challenge instructions.'}</p>{topic.isAssigned ? <p className="catalog-assignee">Assigned to {topic.assignedToName || 'a recruit'}. This assignment cannot be edited.</p> : <div className="actions"><button className="secondary" disabled={busy} onClick={() => edit('topic', topic, challenge.id)}>Edit topic</button><button className="secondary" disabled={busy} onClick={() => remove(`topics/${topic.id}`, topic.title)}>Delete</button></div>}</article>)}</div>
      {!challenge.topics.length && <p className="catalog-empty">No topics yet. Add a topic to make this challenge available on the wheel.</p>}
    </details>)}
    {editor && <div className="modal-backdrop"><div className="modal-card assessment-editor" role="dialog" aria-modal="true" aria-label={`${editor.id ? 'Edit' : 'New'} ${editor.kind}`}>
      <div className="modal-head"><h2>{editor.id ? 'Edit' : 'New'} {editor.kind}</h2><button className="secondary" disabled={busy} onClick={() => setEditor(null)}>Close</button></div>
      <form className="grid-form" onSubmit={save}>
        <label>Title<input required maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label>Description<textarea required={editor.kind === 'challenge'} maxLength={10000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        {editor.kind === 'challenge' && <label>Detailed instructions<textarea required maxLength={20000} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></label>}
        <label className="inline-checkbox"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Active</label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </div></div>}
  </section>;
}

const display = (value) => value === null || value === undefined ? 'Pending' : value;

function CommitmentEntry({ row, onSave, busy }) {
  const [score, setScore] = useState(row.components.commitment ?? '');
  useEffect(() => setScore(row.components.commitment ?? ''), [row.components.commitment]);
  return <form className="commitment-entry" onSubmit={(event) => { event.preventDefault(); onSave(row.id, Number(score)); }}>
    <input aria-label={`Center Commitment for ${row.name}`} required type="number" min="0" max="100" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Not scored" />
    <button disabled={busy || score === ''} type="submit">Save</button>
  </form>;
}

export function AssessmentResults({ token, revision, onRefresh }) {
  const [report, setReport] = useState(null), [weights, setWeights] = useState({ admin: 2, member: 1 });
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  async function load() { const payload = await api('/api/assessments/report', { token }); setReport(payload); setWeights(payload.weights); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, [token, revision]);
  async function run(action) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  const row = report?.rows.find((item) => item.id === selected);
  const rows = report?.rows.filter((item) => `${item.name} ${item.username}`.toLowerCase().includes(query.toLowerCase())) || [];
  const exportReport = (recruitId) => run(() => downloadFile(`/api/assessments/report/export${recruitId ? `?recruitId=${encodeURIComponent(recruitId)}` : ''}`, { token }));
  return <section className={`panel assessment-results ${row ? 'has-individual-report' : ''}`}>
    <div className="section-head"><div><h2>Recruit reviews & final results</h2><p>All recruits · Exam 40% + Presentation 40% + Center Commitment 20%. Missing components remain incomplete.</p></div><div className="actions"><button className="secondary" disabled={busy} onClick={() => run(load)}>Refresh</button><button disabled={busy || !report} onClick={() => exportReport()}>Export all to Excel</button><button className="secondary" onClick={() => window.print()}>Print</button></div></div>
    {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="notice-banner" role="status">{notice}</div>}
    <details className="assessment-weights"><summary>Evaluator weights · Admin {report?.weights.admin ?? 2} / GA {report?.weights.member ?? 1}</summary>
      <p>Changing weights recalculates all reports. Each evaluation keeps the role held by its author when submitted.</p>
      <form className="assessment-toolbar" onSubmit={(event) => { event.preventDefault(); run(async () => { await api('/api/assessments/weights', { token, method: 'PUT', body: { admin: Number(weights.admin), member: Number(weights.member) } }); await load(); await onRefresh(); setNotice('Weights updated and results recalculated.'); }); }}><label>Admin weight<input required type="number" min="0.01" max="100" step="0.01" value={weights.admin} onChange={(e) => setWeights({ ...weights, admin: e.target.value })} /></label><label>GA weight<input required type="number" min="0.01" max="100" step="0.01" value={weights.member} onChange={(e) => setWeights({ ...weights, member: e.target.value })} /></label><button disabled={busy}>Save weights</button></form>
    </details>
    <label className="assessment-search">Find a recruit<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <details><summary>Final score visibility</summary><p>Exam and presentation grades remain visible. These controls release or hide only the combined final score.</p>
      {rows.map((item) => <div className="assessment-toolbar" key={item.id}><span>{item.name} (@{item.username}) · {item.finalVisible ? 'Final score released' : 'Final score hidden'}</span><button disabled={busy} onClick={() => run(async () => { await api(`/api/assessments/recruits/${item.id}/final-visibility`, { token, method: 'PATCH', body: { visible: !item.finalVisible } }); await load(); setNotice('Final score visibility updated.'); })}>{item.finalVisible ? 'Hide final score' : 'Release final score'} for {item.name}</button></div>)}
    </details>
    {!report ? <p role="status">Loading assessment results…</p> : !rows.length ? <p>No recruits match this search.</p> : <div className="table-wrap assessment-consolidated"><table><thead><tr><th>Recruit</th><th>Exam /100</th><th>Presentation /100</th><th>Evaluators</th><th>Commitment /100</th><th>Final /100</th><th>Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><button className="report-row-button" onClick={() => setSelected(item.id)}>{item.name}</button><small>@{item.username}</small></td><td>{display(item.components.exam)}</td><td>{display(item.components.presentation)}</td><td>{item.evaluatorCount}</td><td><CommitmentEntry row={item} busy={busy} onSave={(recruitId, score) => run(async () => { await api(`/api/assessments/commitments/${recruitId}`, { token, method: 'PUT', body: { score } }); await load(); setNotice('Center Commitment saved.'); })} /></td><td><strong>{item.total ?? 'Incomplete'}</strong></td><td>{item.status}</td></tr>)}</tbody></table></div>}
    {row && <section className="assessment-individual">
      <div className="section-head"><div><h3>{row.name} · Individual report</h3><p>@{row.username} · {row.challenge} / {row.topic || 'Unassigned'}</p><p>{row.reservation ? formatDateTime(row.reservation.startAt) : 'Presentation slot not booked'}</p></div><div className="actions"><button disabled={busy} onClick={() => exportReport(row.id)}>Export recruit</button><button className="secondary" onClick={() => window.print()}>Print recruit</button><button className="secondary" onClick={() => setSelected('')}>Close report</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>Component</th><th>Score /100</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>{[['exam', 'Exam', '40%'], ['presentation', 'Presentation', '40%'], ['commitment', 'Center Commitment', '20%']].map(([key, label, weight]) => <tr key={key}><td>{label}</td><td>{display(row.components[key])}</td><td>{weight}</td><td>{display(row.contributions[key])}</td></tr>)}<tr><th>Final result</th><td colSpan="3">{row.total ?? `Incomplete — missing ${row.missing.join(', ')}`}</td></tr></tbody></table></div>
      <h4>Evaluator breakdown</h4><p>Attempt {row.selectedAttempt} contributes to the final result. Presentation = sum(score × weight) ÷ sum(weights).</p>
      <div className="table-wrap"><table><thead><tr><th>Evaluator</th><th>Role</th><th>Attempt</th><th>Score /100</th><th>Weight</th><th>Score × weight</th><th>Used in final</th></tr></thead><tbody>{row.evaluators.map((entry, index) => <tr key={index}><td>{entry.name}</td><td>{entry.role}</td><td>{entry.attempt}</td><td>{entry.score}</td><td>{entry.weight}</td><td>{entry.weightedScore}</td><td>{entry.included ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      <details><summary>Center Commitment history ({row.commitmentHistory.length})</summary><ul>{row.commitmentHistory.map((entry, index) => <li key={index}>{formatDateTime(entry.at)} — {entry.score}/100 by {entry.by}</li>)}</ul></details>
    </section>}
  </section>;
}
