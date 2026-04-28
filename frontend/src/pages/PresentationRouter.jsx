import {
  AdminPresentationPage,
  MemberPresentationPage,
  RecruitPresentationPage
} from './presentations';

export default function PresentationRouter({
  role,
  presentation,
  report,
  selectedYear,
  onChangeYear,
  spinning,
  onSpin,
  onBookSlot,
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
}) {
  if (role === 'new recruit') {
    return (
      <RecruitPresentationPage
        presentation={presentation}
        spinning={spinning}
        onSpin={onSpin}
        onBookSlot={onBookSlot}
        onBack={onBack}
      />
    );
  }

  if (role === 'admin') {
    return (
      <AdminPresentationPage
        presentation={presentation}
        report={report}
        selectedYear={selectedYear}
        onChangeYear={onChangeYear}
        topicDraft={topicDraft}
        setTopicDraft={setTopicDraft}
        slotDraft={slotDraft}
        setSlotDraft={setSlotDraft}
        criterionDraft={criterionDraft}
        setCriterionDraft={setCriterionDraft}
        scoreDraft={scoreDraft}
        setScoreDraft={setScoreDraft}
        scoreOverlayOpen={scoreOverlayOpen}
        setScoreOverlayOpen={setScoreOverlayOpen}
        onCreateTopic={onCreateTopic}
        onDeleteTopic={onDeleteTopic}
        onCreateSlot={onCreateSlot}
        onDeleteSlot={onDeleteSlot}
        onCreateCriterion={onCreateCriterion}
        onUpdateCriterion={onUpdateCriterion}
        onDeleteCriterion={onDeleteCriterion}
        onToggleSecondAttempt={onToggleSecondAttempt}
        onSaveEvaluation={onSaveEvaluation}
        onGenerateReport={onGenerateReport}
        onBack={onBack}
      />
    );
  }

  return (
    <MemberPresentationPage
      presentation={presentation}
      scoreDraft={scoreDraft}
      setScoreDraft={setScoreDraft}
      scoreOverlayOpen={scoreOverlayOpen}
      setScoreOverlayOpen={setScoreOverlayOpen}
      onSaveEvaluation={onSaveEvaluation}
      onBack={onBack}
    />
  );
}
