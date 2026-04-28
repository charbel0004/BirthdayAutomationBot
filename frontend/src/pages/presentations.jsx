import { useEffect, useState } from 'react';
import { CriterionRow, PresentationYearFilter } from '../components/common';
import {
  addMinutesToDateTimeLocal,
  buildScoreDraft,
  formatDateTime,
  getEvaluationTotalScore,
  getMyEvaluationForAttempt,
  isAttemptScoredByCurrentUser
} from '../lib/app';

export function PresentationScoreOverlay({
  isOpen,
  presenter,
  criteria,
  form,
  onChangeScore,
  onChangeComment,
  onClose,
  onSubmit
}) {
  if (!isOpen || !presenter) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card presentation-score-overlay" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Score Presentation</h2>
            <p>{presenter.user.displayName} • {presenter.topic?.title || 'No topic assigned'} • Attempt {form.attempt}</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={onSubmit} className="grid-form presentation-score-form">
          <div className="score-grid">
            {criteria.map((criterion) => (
              <label key={criterion.id} className="slider-field">
                <div className="slider-head">
                  <span>{criterion.title}</span>
                  <strong>{form.scores[criterion.id] || 1}/10</strong>
                </div>
                {criterion.description ? <p className="slider-description">{criterion.description}</p> : null}
                <div className="slider-scale" role="group" aria-label={`${criterion.title} score options`}>
                  {Array.from({ length: 10 }, (_, index) => {
                    const value = index + 1;
                    const selected = Number(form.scores[criterion.id] || 1) === value;
                    return (
                      <button key={value} type="button" className={`slider-scale-button ${selected ? 'is-selected' : ''}`} onClick={() => onChangeScore(criterion.id, value)}>
                        {value}
                      </button>
                    );
                  })}
                </div>
                <input type="range" min="1" max="10" step="1" value={form.scores[criterion.id] || 1} onChange={(event) => onChangeScore(criterion.id, event.target.value)} />
              </label>
            ))}
          </div>
          <label>
            Comment
            <textarea value={form.comment} onChange={(event) => onChangeComment(event.target.value)} rows="4" />
          </label>
          <button type="submit">Save Score</button>
        </form>
      </div>
    </div>
  );
}

export function PresentationReportOverlay({ isOpen, presenter, onClose }) {
  if (!isOpen || !presenter) return null;
  const attempt1Evaluations = (presenter.evaluations || []).filter((item) => Number(item.attempt) === 1);
  const attempt2Evaluations = (presenter.evaluations || []).filter((item) => Number(item.attempt) === 2);
  const showAttempt2 = presenter.allowSecondAttempt === true;

  const renderAttempt = (title, average, evaluations) => (
    <section className="presentation-report-section">
      <div className="presentation-report-section-head">
        <h3>{title}</h3>
        <span>{average ?? 'Pending'}</span>
      </div>
      {evaluations.length ? (
        <div className="presentation-report-evaluations">
          {evaluations.map((evaluation) => (
            <article key={evaluation.id} className="presentation-report-evaluation-card">
              <div className="presentation-report-evaluation-head">
                <strong>{evaluation.evaluator?.displayName || evaluation.evaluator?.username || 'Unknown evaluator'}</strong>
                <span>Total: {evaluation.totalScore}</span>
              </div>
              <div className="presentation-report-criteria">
                {evaluation.criteria.map((criterion) => (
                  <div key={`${evaluation.id}-${criterion.criterionId}`} className="presentation-report-criterion-row">
                    <span>{criterion.title}</span>
                    <strong>{criterion.score}/10</strong>
                  </div>
                ))}
              </div>
              <p className="presentation-report-comment">{evaluation.comment ? evaluation.comment : 'No comment provided.'}</p>
              <div className="presentation-report-updated">Updated: {evaluation.updatedAt ? formatDateTime(evaluation.updatedAt) : 'Pending'}</div>
            </article>
          ))}
        </div>
      ) : (
        <p className="presentation-report-empty">No scores saved for this attempt.</p>
      )}
    </section>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card presentation-report-overlay" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{presenter.user.displayName}</h2>
            <p>{presenter.topic?.title || 'No topic assigned'} • {presenter.slot ? formatDateTime(presenter.slot.startAt) : 'Not booked'}</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <div className="presentation-report-summary">
          <article><span>Attempt 1 Avg</span><strong>{presenter.attempt1Average ?? 'Pending'}</strong></article>
          {showAttempt2 ? <article><span>Attempt 2 Avg</span><strong>{presenter.attempt2Average ?? 'Pending'}</strong></article> : null}
          <article><span>Total</span><strong>{presenter.attempt2Average ?? presenter.attempt1Average ?? 'Pending'}</strong></article>
        </div>
        {renderAttempt('Attempt 1 Details', presenter.attempt1Average, attempt1Evaluations)}
        {showAttempt2 ? renderAttempt('Attempt 2 Details', presenter.attempt2Average, attempt2Evaluations) : null}
      </div>
    </div>
  );
}

export function TopicWheel({ labels, spinning }) {
  return (
    <div className="presentation-wheel-shell">
      <div className="presentation-wheel-pointer" aria-hidden="true">▼</div>
      <div className={`presentation-wheel ${spinning ? 'is-spinning' : ''}`}>
        <div className="presentation-wheel-inner">
          <div className="presentation-wheel-labels">
            {labels.length ? labels.slice(0, 8).map((label) => <span key={label}>{label}</span>) : <span>No topics</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PresentationScoringTable({ presenters, canToggleSecondAttempt, onToggleSecondAttempt, onOpenScore, showActions = true }) {
  return (
    <div className="table-wrap presentation-scoring-table">
      <table>
        <thead>
          <tr>
            <th>Presenter</th>
            <th>Topic</th>
            <th>Slot</th>
            <th>Attempt 1 Avg</th>
            <th>Allow Attempt 2</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {presenters.map((presenter) => (
            <tr key={presenter.user.id}>
              <td>{presenter.user.displayName}</td>
              <td>{presenter.topic?.title || 'Not assigned'}</td>
              <td>{presenter.slot ? formatDateTime(presenter.slot.startAt) : 'Not booked'}</td>
              <td>{presenter.attempt1Average ?? 'Pending'}</td>
              <td>
                {canToggleSecondAttempt ? (
                  <label className="inline-checkbox">
                    <input type="checkbox" checked={presenter.allowSecondAttempt} onChange={(event) => onToggleSecondAttempt(presenter.user.id, event.target.checked)} />
                    Enabled
                  </label>
                ) : (
                  presenter.allowSecondAttempt ? 'Enabled' : 'Disabled'
                )}
              </td>
              {showActions ? (
                <td className="actions">
                  <button type="button" disabled={isAttemptScoredByCurrentUser(presenter, 1)} onClick={() => onOpenScore(presenter.user.id, 1)}>
                    {isAttemptScoredByCurrentUser(presenter, 1) ? 'Scored' : 'Score Attempt 1'}
                  </button>
                  {presenter.allowSecondAttempt ? (
                    <button type="button" className="secondary" disabled={isAttemptScoredByCurrentUser(presenter, 2)} onClick={() => onOpenScore(presenter.user.id, 2)}>
                      {isAttemptScoredByCurrentUser(presenter, 2) ? 'Scored' : 'Score Attempt 2'}
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PresentationPresenterCards({ presenters, canToggleSecondAttempt, onToggleSecondAttempt, onOpenScore }) {
  return (
    <div className="presenter-card-grid">
      {presenters.map((presenter) => (
        <article key={presenter.user.id} className="presenter-card">
          <div className="panel-kicker">Presenter</div>
          <h3>{presenter.user.displayName}</h3>
          <div className="presenter-card-meta">
            <div><span>Topic</span><strong>{presenter.topic?.title || 'Not assigned'}</strong></div>
            <div><span>Slot</span><strong>{presenter.slot ? formatDateTime(presenter.slot.startAt) : 'Not booked'}</strong></div>
            <div><span>Attempt 1 Avg</span><strong>{presenter.attempt1Average ?? 'Pending'}</strong></div>
            {presenter.allowSecondAttempt ? (
              <>
                <div><span>Attempt 2 Avg</span><strong>{presenter.attempt2Average ?? 'Pending'}</strong></div>
                <div><span>Attempt 2</span><strong>Enabled</strong></div>
              </>
            ) : null}
          </div>
          {canToggleSecondAttempt ? (
            <label className="inline-checkbox presenter-card-toggle">
              <input type="checkbox" checked={presenter.allowSecondAttempt} onChange={(event) => onToggleSecondAttempt(presenter.user.id, event.target.checked)} />
              Enable Attempt 2
            </label>
          ) : null}
          <div className="actions presenter-card-actions">
            <button type="button" disabled={isAttemptScoredByCurrentUser(presenter, 1)} onClick={() => onOpenScore(presenter.user.id, 1)}>
              {isAttemptScoredByCurrentUser(presenter, 1) ? 'Scored' : 'Score Attempt 1'}
            </button>
            {presenter.allowSecondAttempt ? (
              <button type="button" className="secondary" disabled={isAttemptScoredByCurrentUser(presenter, 2)} onClick={() => onOpenScore(presenter.user.id, 2)}>
                {isAttemptScoredByCurrentUser(presenter, 2) ? 'Scored' : 'Score Attempt 2'}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function RecruitPresentationPage({ presentation, spinning, onSpin, onBookSlot, onBack }) {
  const recruit = presentation.recruit;
  const ownBookingUserId = recruit?.booking?.booking?.userId || '';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Presentations</div>
          <h2>New Recruit Presentation</h2>
          <p>Spin once to receive your topic, then reserve an available presentation time slot.</p>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
        </div>
      </div>
      {!recruit?.topic ? (
        <section className="panel presentation-spin-panel">
          <div className="presentation-spin-layout">
            <div className="presentation-spin-copy">
              <h2>Presentation Topic Wheel</h2>
              <p>Topics are assigned once. When you spin, the topic is locked to your account.</p>
              <div className="stats-row compact-stats">
                <article className="stat-card"><span>Available topics</span><strong>{presentation.stats.availableTopics}</strong></article>
                <article className="stat-card"><span>Booked slots</span><strong>{presentation.stats.bookedPresentations}</strong></article>
              </div>
              <button type="button" onClick={onSpin} disabled={spinning || !recruit?.availableTopicTitles?.length}>
                {spinning ? 'Assigning topic...' : 'Spin for Topic'}
              </button>
            </div>
            <TopicWheel labels={recruit?.availableTopicTitles || []} spinning={spinning} />
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Your Assigned Topic</h2>
              <p>This topic is already selected for your presentation.</p>
            </div>
          </div>
          <article className="presentation-topic-card">
            <div className="panel-kicker">Assigned Topic</div>
            <h3>{recruit.topic.title}</h3>
            <p>{recruit.topic.description || 'No description added for this subject yet.'}</p>
          </article>
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Presentation Time Slots</h2>
            <p>Choose one open slot. Once another recruit takes it, it is no longer available.</p>
          </div>
        </div>
        {recruit?.booking ? <div className="info-banner">Your current slot is <strong>{formatDateTime(recruit.booking.startAt)}</strong>.</div> : null}
        <div className="slot-grid">
          {(recruit?.slots || []).map((slot) => (
            <article key={slot.id} className={`slot-card ${slot.booking?.userId === ownBookingUserId ? 'is-own' : ''}`}>
              <h3>{formatDateTime(slot.startAt)}</h3>
              <p>Ends at {formatDateTime(slot.endAt)}</p>
              <button type="button" className={slot.isBooked && slot.booking?.userId !== ownBookingUserId ? 'secondary' : undefined} disabled={!recruit?.topic || (slot.isBooked && slot.booking?.userId !== ownBookingUserId)} onClick={() => onBookSlot(slot.id)}>
                {slot.booking?.userId === ownBookingUserId ? 'Selected' : slot.isBooked ? `Taken${slot.bookedByName ? ` by ${slot.bookedByName}` : ''}` : 'Reserve Slot'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function MemberPresentationPage({ presentation, scoreDraft, setScoreDraft, scoreOverlayOpen, setScoreOverlayOpen, onSaveEvaluation, onBack }) {
  const [search, setSearch] = useState('');
  const presentersWithTopics = presentation.presenters;
  const filteredPresenters = presentersWithTopics.filter((item) => (item.user.displayName || '').toLowerCase().includes(search.trim().toLowerCase()));
  const selectedPresenter = presentersWithTopics.find((item) => item.user.id === scoreDraft.presenterId) || null;

  const openScoreOverlay = (presenterId, attempt) => {
    const presenter = presentersWithTopics.find((item) => item.user.id === presenterId);
    if (!presenter || isAttemptScoredByCurrentUser(presenter, attempt)) return;
    const savedEvaluation = getMyEvaluationForAttempt(presenter, attempt);
    const nextDraft = buildScoreDraft(presentation.activeCriteria, savedEvaluation);
    setScoreDraft({ presenterId, attempt, scores: nextDraft.scores, comment: nextDraft.comment });
    setScoreOverlayOpen(true);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Presentations</div>
          <h2>Presentation Programme</h2>
          <p>Review presenters, assigned topics, and the grading structure used by the admin team.</p>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
        </div>
      </div>
      <section className="panel">
        <div className="stats-row">
          <article className="stat-card"><span>Assigned topics</span><strong>{presentation.stats.assignedTopics}</strong></article>
          <article className="stat-card"><span>Open slots</span><strong>{presentation.stats.openSlots}</strong></article>
          <article className="stat-card"><span>Evaluated presentations</span><strong>{presentation.stats.evaluatedPresentations}</strong></article>
          <article className="stat-card"><span>Average score</span><strong>{presentation.stats.averageScore}</strong></article>
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Presentation Table</h2>
            <p>Review presenters, topics, scheduled times, active grading criteria, and score them from one section.</p>
          </div>
        </div>
        <form className="filter-form presentation-search-form" onSubmit={(event) => event.preventDefault()}>
          <input placeholder="Search presenter by name" value={search} onChange={(event) => setSearch(event.target.value)} />
        </form>
        <div className="criteria-grid presentation-criteria-grid">
          {presentation.activeCriteria.map((criterion) => (
            <article key={criterion.id} className="criteria-card">
              <div className="panel-kicker">Criterion {criterion.order}</div>
              <h3>{criterion.title}</h3>
              <p>{criterion.description || 'No description provided.'}</p>
            </article>
          ))}
        </div>
        <PresentationPresenterCards presenters={filteredPresenters} canToggleSecondAttempt={false} onToggleSecondAttempt={() => {}} onOpenScore={openScoreOverlay} />
        <PresentationScoringTable presenters={filteredPresenters} canToggleSecondAttempt={false} onToggleSecondAttempt={() => {}} onOpenScore={openScoreOverlay} />
      </section>
      <PresentationScoreOverlay
        isOpen={scoreOverlayOpen}
        presenter={selectedPresenter}
        criteria={presentation.activeCriteria}
        form={scoreDraft}
        onChangeScore={(criterionId, value) => setScoreDraft((current) => ({ ...current, scores: { ...current.scores, [criterionId]: value } }))}
        onChangeComment={(value) => setScoreDraft((current) => ({ ...current, comment: value }))}
        onClose={() => setScoreOverlayOpen(false)}
        onSubmit={onSaveEvaluation}
      />
    </div>
  );
}

export function AdminPresentationPage(props) {
  const {
    presentation,
    report,
    selectedYear,
    onChangeYear,
    topicDraft,
    setTopicDraft,
    slotDraft,
    setSlotDraft,
    criterionDraft,
    setCriterionDraft,
    scoreDraft,
    setScoreDraft,
    scoreOverlayOpen,
    setScoreOverlayOpen,
    onCreateTopic,
    onDeleteTopic,
    onCreateSlot,
    onDeleteSlot,
    onCreateCriterion,
    onUpdateCriterion,
    onDeleteCriterion,
    onToggleSecondAttempt,
    onSaveEvaluation,
    onGenerateReport,
    onBack
  } = props;

  const presentersWithTopics = presentation.presenters;
  const selectedPresenter = presentersWithTopics.find((item) => item.user.id === scoreDraft.presenterId) || null;
  const [reportOverlayPresenterId, setReportOverlayPresenterId] = useState('');
  const selectedReportPresenter = presentersWithTopics.find((item) => item.user.id === reportOverlayPresenterId) || null;

  useEffect(() => {
    if (!selectedPresenter) return;
    const activeAttempt = Number(scoreDraft.attempt || 1);
    const savedEvaluation = getMyEvaluationForAttempt(selectedPresenter, activeAttempt) || selectedPresenter.myEvaluation || null;
    const nextDraft = buildScoreDraft(presentation.activeCriteria, savedEvaluation);
    setScoreDraft({ presenterId: selectedPresenter.user.id, attempt: activeAttempt, scores: nextDraft.scores, comment: nextDraft.comment });
  }, [selectedPresenter?.user.id, scoreDraft.attempt]);

  const openScoreOverlay = (presenterId, attempt) => {
    const presenter = presentersWithTopics.find((item) => item.user.id === presenterId);
    if (!presenter || isAttemptScoredByCurrentUser(presenter, attempt)) return;
    const savedEvaluation = getMyEvaluationForAttempt(presenter, attempt);
    const nextDraft = buildScoreDraft(presentation.activeCriteria, savedEvaluation);
    setScoreDraft({ presenterId, attempt, scores: nextDraft.scores, comment: nextDraft.comment });
    setScoreOverlayOpen(true);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Presentations</div>
          <h2>Presentation Administration</h2>
          <p>Control topics, slots, grading criteria, scoring, and reports for the recruit presentation process.</p>
        </div>
        <div className="top-actions">
          <PresentationYearFilter years={presentation.availableYears} value={selectedYear} onChange={onChangeYear} />
          <button type="button" className="secondary" onClick={onBack}>Back to Hub</button>
        </div>
      </div>
      <section className="panel">
        <div className="stats-row">
          <article className="stat-card"><span>Total topics</span><strong>{presentation.stats.totalTopics}</strong></article>
          <article className="stat-card"><span>Assigned topics</span><strong>{presentation.stats.assignedTopics}</strong></article>
          <article className="stat-card"><span>Booked slots</span><strong>{presentation.stats.bookedPresentations}</strong></article>
          <article className="stat-card"><span>Average score</span><strong>{presentation.stats.averageScore}</strong></article>
        </div>
      </section>
      <section className="panel">
        <div className="section-head"><div><h2>Presentation Subjects</h2><p>Add or remove the subjects available on the spinning wheel.</p></div></div>
        <form className="grid-form admin-inline-form" onSubmit={onCreateTopic}>
          <input placeholder="Subject title" value={topicDraft.title} onChange={(event) => setTopicDraft({ ...topicDraft, title: event.target.value })} required />
          <input placeholder="Subject description" value={topicDraft.description} onChange={(event) => setTopicDraft({ ...topicDraft, description: event.target.value })} />
          <button type="submit">Add Subject</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Title</th><th>Description</th><th>Status</th><th>Assigned at</th><th>Actions</th></tr></thead><tbody>{(presentation.admin?.topics || []).map((topic) => (
          <tr key={topic.id}>
            <td>{topic.title}</td>
            <td>{topic.description || 'No description'}</td>
            <td>{topic.isAssigned ? 'Assigned' : 'Available'}</td>
            <td>{topic.assignedAt ? formatDateTime(topic.assignedAt) : 'Not assigned'}</td>
            <td className="actions"><button type="button" className="secondary" disabled={topic.isAssigned} onClick={() => onDeleteTopic(topic.id)}>Delete</button></td>
          </tr>
        ))}</tbody></table></div>
      </section>
      <section className="panel">
        <div className="section-head"><div><h2>Presentation Time Spots</h2><p>Add the presentation slots that new recruits can reserve.</p></div></div>
        <form className="grid-form slot-form" onSubmit={onCreateSlot}>
          <label>
            Range Start
            <input type="datetime-local" value={slotDraft.rangeStartAt} onChange={(event) => setSlotDraft((current) => ({ ...current, rangeStartAt: event.target.value, rangeEndAt: current.rangeEndAt || addMinutesToDateTimeLocal(event.target.value, current.durationMinutes || 10) }))} required />
          </label>
          <label>
            Range End
            <input type="datetime-local" value={slotDraft.rangeEndAt} onChange={(event) => setSlotDraft({ ...slotDraft, rangeEndAt: event.target.value })} required />
          </label>
          <label>
            Duration (minutes)
            <input type="number" min="5" step="5" value={slotDraft.durationMinutes} onChange={(event) => setSlotDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) || 10 }))} required />
          </label>
          <button type="submit">Generate Slots</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Start</th><th>End</th><th>Booked by</th><th>Actions</th></tr></thead><tbody>{(presentation.admin?.slots || []).map((slot) => (
          <tr key={slot.id}>
            <td>{formatDateTime(slot.startAt)}</td>
            <td>{formatDateTime(slot.endAt)}</td>
            <td>{slot.bookedByName || 'Open'}</td>
            <td className="actions"><button type="button" className="secondary" disabled={slot.isBooked} onClick={() => onDeleteSlot(slot.id)}>Delete</button></td>
          </tr>
        ))}</tbody></table></div>
      </section>
      <section className="panel">
        <div className="section-head"><div><h2>Grading Criteria</h2><p>Maintain the evaluation structure used when scoring presentations.</p></div></div>
        <form className="grid-form criterion-form" onSubmit={onCreateCriterion}>
          <input placeholder="Criterion title" value={criterionDraft.title} onChange={(event) => setCriterionDraft({ ...criterionDraft, title: event.target.value })} required />
          <input placeholder="Description" value={criterionDraft.description} onChange={(event) => setCriterionDraft({ ...criterionDraft, description: event.target.value })} />
          <input type="number" min="1" value={criterionDraft.order} onChange={(event) => setCriterionDraft({ ...criterionDraft, order: Number(event.target.value) })} required />
          <label className="inline-checkbox"><input type="checkbox" checked={criterionDraft.isActive} onChange={(event) => setCriterionDraft({ ...criterionDraft, isActive: event.target.checked })} />Active</label>
          <button type="submit">Add Criterion</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Title</th><th>Description</th><th>Status</th><th>Actions</th><th /></tr></thead><tbody>{(presentation.admin?.criteria || []).map((criterion) => (
          <CriterionRow key={criterion.id} criterion={criterion} onSave={onUpdateCriterion} onDelete={onDeleteCriterion} />
        ))}</tbody></table></div>
      </section>
      <section className="panel">
        <div className="section-head"><div><h2>Presenter Scoring</h2><p>Review presenters in a table, enable attempt two when needed, and open the scoring sheet from each row.</p></div></div>
        <PresentationScoringTable presenters={presentersWithTopics} canToggleSecondAttempt onToggleSecondAttempt={onToggleSecondAttempt} onOpenScore={openScoreOverlay} />
      </section>
      <section className="panel">
        <div className="section-head"><div><h2>Results and Report</h2><p>Review ranked results and generate the latest presentation report.</p></div><button type="button" onClick={onGenerateReport}>Refresh Report</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Presenter</th><th>Topic</th><th>Slot</th><th>Attempt 1 Avg</th><th>Attempt 1 Details</th><th>Attempt 2 Avg</th><th>Attempt 2 Details</th><th>Total score</th><th>Updated</th></tr></thead>
            <tbody>{report.rankings.map((row) => (
              <tr key={row.username} className="report-row-clickable" onClick={() => setReportOverlayPresenterId(presentersWithTopics.find((item) => item.user.username === row.username)?.user.id || '')}>
                <td><button type="button" className="report-row-button" onClick={() => setReportOverlayPresenterId(presentersWithTopics.find((item) => item.user.username === row.username)?.user.id || '')}>{row.presenter}</button></td>
                <td>{row.topic}</td>
                <td>{row.slot ? formatDateTime(row.slot) : 'Not booked'}</td>
                <td>{row.attempt1Score ?? 'Pending'}</td>
                <td>{row.attempt1Breakdown?.length ? `${row.attempt1Breakdown.length} score(s)` : 'Pending'}</td>
                <td>{row.allowSecondAttempt ? (row.attempt2Score ?? 'Pending') : ''}</td>
                <td>{row.allowSecondAttempt ? (row.attempt2Breakdown?.length ? `${row.attempt2Breakdown.length} score(s)` : 'Pending') : ''}</td>
                <td>{row.totalScore ?? 'Pending'}</td>
                <td>{row.scoredAt ? formatDateTime(row.scoredAt) : 'Pending'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <PresentationScoreOverlay isOpen={scoreOverlayOpen} presenter={selectedPresenter} criteria={presentation.activeCriteria} form={scoreDraft} onChangeScore={(criterionId, value) => setScoreDraft((current) => ({ ...current, scores: { ...current.scores, [criterionId]: value } }))} onChangeComment={(value) => setScoreDraft((current) => ({ ...current, comment: value }))} onClose={() => setScoreOverlayOpen(false)} onSubmit={onSaveEvaluation} />
      <PresentationReportOverlay isOpen={Boolean(selectedReportPresenter)} presenter={selectedReportPresenter} onClose={() => setReportOverlayPresenterId('')} />
    </div>
  );
}
