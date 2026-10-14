import { createPortal } from 'react-dom';

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
  const percentage = (Number(result.score) / Number(result.maximumScore)) * 100;
  const passed = percentage >= 60;

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
        <button type="button" className="secondary exam-result-delete" onClick={() => onDelete(result)}>
          Delete result
        </button>
      ) : null}
    </article>
  );
}

export default function ExamResultsPage({ role, users, results, draft, setDraft, saving, onSubmit, onDelete }) {
  const isAdmin = role === 'admin';
  const hasPassedResult = !isAdmin && results.some((result) => (
    (Number(result.score) / Number(result.maximumScore)) * 100 >= 60
  ));
  const recruitsWithResults = new Set(results.map((result) => result.recruitUserId));
  const recruits = users.filter((user) => (
    user.role === 'new recruit' && user.active !== false && !recruitsWithResults.has(user.id)
  ));
  return (
    <div className={`page-shell exam-results-page ${hasPassedResult ? 'exam-passed-celebration' : ''}`.trim()}>
      {hasPassedResult ? <PassingConfetti /> : null}
      <div className="page-header">
        <div>
          <div className="panel-kicker">{isAdmin ? 'Recruit assessment' : 'Your progress'}</div>
          <h2>Exam Results</h2>
          <p>{isAdmin
            ? 'Record exam grades for new recruits.'
            : 'Your official GA Exam result.'}</p>
        </div>
      </div>

      {isAdmin ? (
        <section className="panel">
          <div className="section-head">
            <div><h2>Add an exam result</h2><p>The grade will only be visible to admins and the selected recruit.</p></div>
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
            <button type="submit" disabled={saving || !recruits.length}>{saving ? 'Saving result...' : 'Publish result'}</button>
            {!recruits.length ? <p className="muted-table-value">All active new recruits already have a result, or no active recruits are available.</p> : null}
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{isAdmin ? 'Published results' : 'Your results'}</h2>
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
    </div>
  );
}
