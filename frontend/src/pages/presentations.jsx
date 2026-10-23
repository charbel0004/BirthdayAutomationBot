import { useEffect, useRef, useState } from 'react';
import { ChallengeDetails, ChallengeManagement } from './AssessmentPanels';
import { CriterionRow, PresentationYearFilter } from '../components/common';
import {
  addMinutesToDateTimeLocal,
  buildScoreDraft,
  formatDateTime,
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
      <div className="modal-card presentation-score-overlay" role="dialog" aria-modal="true" aria-label="Score presentation" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Score Presentation</h2>
            <p>{presenter.user.displayName} • {presenter.topic?.title || 'No topic assigned'} • Attempt {form.attempt}</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={onSubmit} className="grid-form presentation-score-form">
          <ChallengeDetails topic={presenter.topic} />
          <div className="score-grid">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="slider-field">
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
                      <button key={value} type="button" aria-pressed={selected} aria-label={`${criterion.title}: ${value} out of 10`} className={`slider-scale-button ${selected ? 'is-selected' : ''}`} onClick={() => onChangeScore(criterion.id, value)}>
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <label>
            Comment
            <textarea value={form.comment} onChange={(event) => onChangeComment(event.target.value)} rows="4" />
          </label>
          <div className="presentation-score-footer"><button type="submit" disabled={!criteria.length}>Save Score</button></div>
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
                <span>Score: {evaluation.totalScore ?? 'Incomplete'}/100 · Weight: {evaluation.weight ?? '—'}</span>
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

/**
 * A numbered SVG wheel: long titles are shown in the adjacent, accessible legend.
 * The server remains the source of truth for the assigned topic.
 */
export function TopicWheel({ options = [], spinning = false, selectedId = null, onAnimationComplete }) {
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);
  const lastAnimatedSelection = useRef(null);
  const timer = useRef(null);
  const completionCallback = useRef(onAnimationComplete);
  const visual = useRef(null);
  completionCallback.current = onAnimationComplete;
  const count = options.length;
  const segmentAngle = count ? 360 / count : 360;
  const center = 150;
  const radius = 132;
  const selectedIndex = options.findIndex((option) => option.id === selectedId);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 250 : 2400;
  const groups = [...new Set(options.map((option) => option.challenge?.title || 'Presentation'))];

  useEffect(() => {
    if (spinning) visual.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }, [spinning, reducedMotion]);

  useEffect(() => {
    if (!spinning || selectedId || reducedMotion) return;
    let frame, last;
    const tick = (time) => {
      if (last !== undefined) setRotation((value) => value + Math.min(time - last, 50) * .48);
      last = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning, selectedId, reducedMotion]);

  useEffect(() => {
    if (!selectedId || !count || selectedIndex < 0 || lastAnimatedSelection.current === selectedId) return;
    lastAnimatedSelection.current = selectedId;
    setAnimating(true);
    // Segment i is centered at i * segmentAngle. Align that center with the top pointer.
    const targetMod = ((-selectedIndex * segmentAngle) % 360 + 360) % 360;
    setRotation((previous) => {
      const previousMod = ((previous % 360) + 360) % 360;
      const correction = ((targetMod - previousMod) % 360 + 360) % 360;
      return previous + (reducedMotion ? 0 : 360 * 3) + correction;
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAnimating(false);
      completionCallback.current?.();
    }, duration + 150);
    return () => clearTimeout(timer.current);
  }, [selectedId, selectedIndex, count, segmentAngle, duration, reducedMotion]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const polar = (degrees, distance) => {
    const radians = (degrees - 90) * Math.PI / 180;
    return [center + distance * Math.cos(radians), center + distance * Math.sin(radians)];
  };
  const wedge = (index) => {
    const start = index * segmentAngle - segmentAngle / 2;
    const end = start + segmentAngle;
    const [x1, y1] = polar(start, radius);
    const [x2, y2] = polar(end, radius);
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${segmentAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="topic-wheel-area">
      <div ref={visual} className="topic-wheel-visual" aria-label={`Presentation topic wheel with ${count} topics`}>
        <svg viewBox="0 0 300 300" className="topic-wheel-svg" role="img" aria-label={count ? `${count} numbered topic segments` : 'No topics available'}>
          {!count && <circle cx={center} cy={center} r={radius} fill="#f2edef" stroke="#e2d6d9" strokeWidth="2" />}
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '150px 150px', transition: animating ? `transform ${duration}ms cubic-bezier(0.12, 0.75, 0.12, 1)` : 'none' }}>
            {options.map((option, index) => {
              const [tx, ty] = polar(index * segmentAngle, count > 24 ? 107 : 96);
              return (
                <g key={option.id}>
                  {count === 1 ? <circle cx={center} cy={center} r={radius} fill="#bf2331" /> : <path d={wedge(index)} fill={index % 2 ? '#f4ddd8' : '#bf2331'} stroke="#fff" strokeWidth="1.5" />}
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={count > 35 ? 9 : count > 24 ? 11 : 13} fontWeight="700" fill={index % 2 ? '#8b1722' : '#fff'} transform={`rotate(${index * segmentAngle}, ${tx}, ${ty})`}>{index + 1}</text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="22" fill="#fff" stroke="#a51d29" strokeWidth="5" />
            <circle cx="150" cy="150" r="8" fill="#bf2331" />
          </g>
          <path d="M 138 0 L 162 0 L 150 31 Z" fill="#8e1722" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <div className="topic-wheel-legend" aria-label="Topic number legend">
        <strong>{groups.length} challenges · {count} available topics</strong>
        <p>Each number represents one topic. Its challenge defines the format and instructions.</p>
        {groups.map((group) => <details key={group} className="wheel-challenge-group"><summary>{group}<small>{options.filter((option) => (option.challenge?.title || 'Presentation') === group).length} topics</small></summary><ol>
          {options.map((option, index) => (option.challenge?.title || 'Presentation') === group && <li key={option.id}><span className="topic-wheel-legend-number">{index + 1}</span><div><strong>{option.title}</strong>{option.description && <p>{option.description}</p>}</div></li>)}
        </ol></details>)}
      </div>
      <p className="topic-wheel-status" role="status">{spinning || animating ? (selectedId ? 'The wheel is settling on your topic…' : 'Spinning and securing your assignment…') : count ? 'One spin. One topic. Your challenge starts here.' : 'No topics available yet. Please check back later.'}</p>
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
  const [wheelPending, setWheelPending] = useState(false);
  const [wheelOptions, setWheelOptions] = useState([]);
  const [justRevealed, setJustRevealed] = useState(false);
  const revealHeading = useRef(null);
  useEffect(() => {
    if (justRevealed) {
      revealHeading.current?.focus({ preventScroll: true });
      revealHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }, [justRevealed]);
  const selectedTopicId = recruit?.topic?.id || null;
  const onSpinWithAnimation = async () => {
    if (wheelPending || spinning || recruit?.topic) return;
    setWheelOptions([...(recruit?.availableTopics || [])]);
    setWheelPending(true);
    try { if (await onSpin() === false) setWheelPending(false); }
    catch { setWheelPending(false); }
  };
  useEffect(() => {
    if (wheelPending && selectedTopicId && !wheelOptions.some((option) => option.id === selectedTopicId)) {
      setWheelPending(false);
    }
  }, [wheelPending, selectedTopicId, wheelOptions]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Presentations</div>
          <h2>New Recruit Presentation</h2>
          <p>Spin once to receive your challenge and topic, then reserve an available presentation time slot.</p>
        </div>
        <div className="top-actions">
        </div>
      </div>
      {(!recruit?.topic || wheelPending) ? (
        <section className="panel presentation-spin-panel">
          <div className="presentation-spin-layout">
            <div className="presentation-spin-copy">
              <h2>Presentation Challenge Wheel</h2>
              <p>A challenge is the presentation format. A topic is the specific subject you will work on.</p>
              <ol className="challenge-steps"><li><strong>Explore</strong><span>Browse the challenges and their available topics.</span></li><li><strong>Spin once</strong><span>Receive one random available topic and its challenge. The assignment is permanent.</span></li><li><strong>Prepare & present</strong><span>Read your instructions, then reserve a time slot.</span></li></ol>
              <div className="stats-row compact-stats">
                <article className="stat-card"><span>Available topics</span><strong>{presentation.stats.availableTopics}</strong></article>
                <article className="stat-card"><span>Booked slots</span><strong>{presentation.stats.bookedPresentations}</strong></article>
              </div>
              <button type="button" onClick={onSpinWithAnimation} disabled={spinning || wheelPending || !recruit?.availableTopics?.length}>
                {spinning || wheelPending ? 'Assigning challenge...' : 'Spin for Challenge'}
              </button>
            </div>
            <TopicWheel options={wheelPending ? wheelOptions : (recruit?.availableTopics || [])} spinning={wheelPending} selectedId={wheelPending ? selectedTopicId : null} onAnimationComplete={() => { setJustRevealed(true); setWheelPending(false); }} />
          </div>
        </section>
      ) : (
        <section className={`panel assignment-reveal ${justRevealed ? 'is-new' : ''}`} role="status">
          <div className="section-head">
            <div>
              <h2 ref={revealHeading} tabIndex={-1} className="assignment-reveal-heading">Your Challenge & Topic</h2>
              <p>Your assignment is saved. You can return to these instructions at any time.</p>
            </div>
          </div>
          <article className="presentation-topic-card">
            <ChallengeDetails topic={recruit.topic} expanded />
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
              <button type="button" className={slot.isBooked && slot.booking?.userId !== ownBookingUserId ? 'secondary' : undefined} disabled={wheelPending || !recruit?.topic || (slot.isBooked && slot.booking?.userId !== ownBookingUserId)} onClick={() => onBookSlot(slot.id)}>
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
    scoringOnly = false,
    onChangeView,
    token,
    onRefresh,
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

  const [search, setSearch] = useState('');
  const presentersWithTopics = presentation.presenters;
  const filteredPresenters = presentersWithTopics.filter((item) => (item.user.displayName || '').toLowerCase().includes(search.trim().toLowerCase()));
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
          <h2>{scoringOnly ? 'Presentation Scoring' : 'Presentation Setup'}</h2>
          <p>{scoringOnly ? 'Choose a presenter and score their interview presentation.' : 'Manage challenges, time slots, grading criteria, and reports.'}</p>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary" onClick={() => onChangeView(!scoringOnly)}>{scoringOnly ? 'Presentation Setup' : 'Open Scoring Page'}</button>
          <PresentationYearFilter years={presentation.availableYears} value={selectedYear} onChange={onChangeYear} />
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
      {!scoringOnly && <>
      <ChallengeManagement token={token} onRefresh={onRefresh} />
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
      </>}
      {scoringOnly && <section className="panel">
        <div className="section-head"><div><h2>Presenter Scoring</h2><p>Review presenters in a table, enable attempt two when needed, and open the scoring sheet from each row.</p></div></div>
        <form className="filter-form presentation-search-form" onSubmit={(event) => event.preventDefault()}><input aria-label="Search presenter by name" placeholder="Search presenter by name" value={search} onChange={(event) => setSearch(event.target.value)} /></form>
        {!filteredPresenters.length && <p>No presenters found.</p>}
        <PresentationPresenterCards presenters={filteredPresenters} canToggleSecondAttempt onToggleSecondAttempt={onToggleSecondAttempt} onOpenScore={openScoreOverlay} />
        <PresentationScoringTable presenters={filteredPresenters} canToggleSecondAttempt onToggleSecondAttempt={onToggleSecondAttempt} onOpenScore={openScoreOverlay} />
      </section>
      }
      {!scoringOnly && <section className="panel">
        <div className="section-head"><div><h2>Presentation attempt details</h2><p>Review weighted averages and individual criterion scores.</p></div><button type="button" onClick={onGenerateReport}>Refresh Report</button></div>
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
      }
      <PresentationScoreOverlay isOpen={scoreOverlayOpen} presenter={selectedPresenter} criteria={presentation.activeCriteria} form={scoreDraft} onChangeScore={(criterionId, value) => setScoreDraft((current) => ({ ...current, scores: { ...current.scores, [criterionId]: value } }))} onChangeComment={(value) => setScoreDraft((current) => ({ ...current, comment: value }))} onClose={() => setScoreOverlayOpen(false)} onSubmit={onSaveEvaluation} />
      <PresentationReportOverlay isOpen={Boolean(selectedReportPresenter)} presenter={selectedReportPresenter} onClose={() => setReportOverlayPresenterId('')} />
    </div>
  );
}
