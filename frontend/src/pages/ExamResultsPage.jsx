import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/app';
import { AssessmentResults } from './AssessmentPanels';

function PassingConfetti() {
  const colors = ['#e53946', '#f5ba38', '#37a875', '#368ee0', '#a770dc', '#f18cab'];
  return createPortal(
    <div className="exam-confetti" aria-hidden="true">
      {Array.from({ length: 72 }, (_, index) => (
        <span key={index} className="exam-confetti-piece" style={{
          left: `${(index * 37.17) % 100}%`,
          '--confetti-color': colors[index % colors.length],
          '--confetti-duration': `${6 + (index % 7) * .6}s`,
          '--confetti-delay': `${-((index * 1.31) % 10)}s`,
          '--confetti-drift': `${((index * 43) % 180) - 90}px`,
          '--confetti-spin': `${index % 2 ? 720 : -540}deg`,
          '--confetti-width': `${5 + index % 5}px`
        }}><i /></span>
      ))}
    </div>,
    document.body
  );
}

function ResultCard({ result, canDelete, onDelete }) {
  const passed = result.passed === true;

  return (
    <article className={`exam-result-card ${canDelete ? '' : 'recruit-result-card'} ${passed ? 'is-passed' : 'is-not-passed'}`.trim()}>
      {!canDelete ? (
        <div className="exam-result-status-icon" aria-hidden="true">{passed ? '✓' : '!'}</div>
      ) : null}
      <div className="exam-result-card-head">
        <div>
          <h3>{result.examName}</h3>
          {result.recruit ? <p>{result.recruit.displayName} · @{result.recruit.username}</p> : null}
        </div>
        <div className="exam-result-grade-block">
          <span className={`exam-result-status ${passed ? 'passed' : 'not-passed'}`}>{passed ? 'Passed' : 'Not passed'}</span>
          <div className="exam-result-score">
            <strong>{result.score}</strong>
            <span>out of {result.maximumScore}</span>
          </div>
        </div>
      </div>
      {!canDelete ? (
        <p className="exam-result-message">
          {passed ? `Congratulations! You passed the ${result.examName}.` : 'The passing grade is 60%. Keep preparing for your next attempt.'}
        </p>
      ) : null}
      {canDelete ? (
        <div className="actions">
        <span>Published · Visible to recruit</span>
        <button type="button" className="secondary exam-result-delete" onClick={() => onDelete(result)}>
          Delete result
        </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ExamResultsPage({ token, onRefresh, role, users, results, draft, setDraft, saving, onSubmit, onDelete }) {
  const [assessment, setAssessment] = useState(null), [error, setError] = useState('');
  const isAdmin = role === 'admin';
  useEffect(() => {
    if (isAdmin) return;
    let active = true;
    setAssessment(null); setError('');
    api('/api/assessments/me', { token }).then((data) => { if (active) setAssessment(data); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [token, isAdmin, results]);
  const hasPassedResult = !isAdmin && results.some((result) => (
    result.passed === true
  ));
  const recruitsWithResults = new Set(results.map((result) => result.recruitUserId));
  const recruits = users.filter((user) => (
    user.role === 'new recruit' && user.active !== false && !recruitsWithResults.has(user.id)
  ));
  return (
    <div className={`page-shell exam-results-page ${hasPassedResult ? 'exam-passed-celebration' : ''}`.trim()}>
      {hasPassedResult ? <PassingConfetti /> : null}
      {error && <div role="alert" className="error-banner">{error}</div>}
      <div className="page-header">
        <div>
          <div className="panel-kicker">{isAdmin ? 'Recruit assessment' : 'Your progress'}</div>
          <h2>Exam Results</h2>
          <p>{isAdmin
            ? 'Record exam grades for new recruits.'
            : 'Your exam, presentation and final score.'}</p>
        </div>
      </div>

      {isAdmin ? (
        <section className="panel">
          <div className="section-head">
            <div><h2>Add an exam result</h2><p>Saving publishes the exam grade immediately. Presentation and final results are published separately below.</p></div>
          </div>
          <form className="grid-form exam-result-form" onSubmit={onSubmit}>
            <label>
              New recruit name
              <select required value={draft.recruitUserId} onChange={(event) => setDraft((current) => ({ ...current, recruitUserId: event.target.value }))}>
                <option value="">Select a recruit</option>
                {recruits.map((recruit) => <option key={recruit.id} value={recruit.id}>{recruit.displayName} (@{recruit.username})</option>)}
              </select>
            </label>
            <label>
              Test name
              <input required maxLength="120" value={draft.examName} onChange={(event) => setDraft((current) => ({ ...current, examName: event.target.value }))} placeholder="First aid theory exam" />
            </label>
            <label>
              Grade
              <input required type="number" min="0" step="0.01" value={draft.score} onChange={(event) => setDraft((current) => ({ ...current, score: event.target.value }))} placeholder="85" />
            </label>
            <label>
              Out of
              <input required type="number" min="0.01" step="0.01" value={draft.maximumScore} onChange={(event) => setDraft((current) => ({ ...current, maximumScore: event.target.value }))} placeholder="100" />
            </label>
            <button type="submit" disabled={saving || !recruits.length}>{saving ? 'Saving result...' : 'Save grade'}</button>
            {!recruits.length ? <p className="muted-table-value">All active new recruits already have a result, or no active recruits are available.</p> : null}
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Exam</h2>
            <p>{isAdmin ? `${results.length} result${results.length === 1 ? '' : 's'} recorded.` : 'The passing grade is 60%.'}</p>
          </div>
        </div>
        {results.length ? (
          <div className="exam-results-grid">
            {results.map((result) => <ResultCard key={result.id} result={result} canDelete={isAdmin} onDelete={onDelete} />)}
          </div>
        ) : (
          <div className="repository-empty-state">
            <strong>No exam results yet</strong>
            <span>{isAdmin ? 'Publish the first result using the form above.' : 'Your results will appear here after an admin publishes them.'}</span>
          </div>
        )}
      </section>
      {isAdmin ? <AssessmentResults token={token} revision={results} onRefresh={onRefresh} /> : <>
        <section className="panel">
          <div className="section-head"><div><h2>Presentation</h2><p>Your weighted presentation result.</p></div></div>
          {!assessment ? <p>{error ? 'Unable to load presentation result.' : 'Loading…'}</p> : !assessment.presentationVisible ? <p>Your presentation result has not been released yet.</p> : assessment.presentation === null ? <p>Your presentation has not been graded yet.</p> : <div className="exam-result-score"><strong>{assessment.presentation}</strong><span>out of 100 · Attempt {assessment.selectedAttempt}</span></div>}
        </section>
        <section className="panel">
          <div className="section-head"><div><h2>Final Score</h2><p>Exam 40% + Presentation 40% + Center Commitment 20%.</p></div></div>
          {!assessment ? <p>{error ? 'Unable to load final score.' : 'Loading…'}</p> : !assessment.finalVisible ? <p>Your final score has not been released yet.</p> : assessment.total === null ? <p>Incomplete — awaiting {assessment.missing.join(', ')}.</p> : <>
            <div className="exam-result-score"><strong>{assessment.total}</strong><span>out of 100</span></div>
            <p>Exam: {assessment.components.exam}/100 · Presentation: {assessment.presentationVisible ? `${assessment.components.presentation}/100` : 'Not released'} · Center Commitment: {assessment.components.commitment}/100</p>
          </>}
        </section>
      </>}
    </div>
  );
}
