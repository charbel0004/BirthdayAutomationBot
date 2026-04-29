import {
  RecruitmentCallCenterPage,
  RecruitmentPage,
  RecruitmentRepositoryPage
} from './recruitment';

export default function RecruitmentRouter({
  page,
  recruitmentLeads,
  recruitmentFilters,
  setRecruitmentFilters,
  recruitmentLeadDraft,
  setRecruitmentLeadDraft,
  recruitmentLeadCreateError,
  recruitmentLeadCreateSaving,
  publicFormUrl,
  canManageRecruitment,
  onOpenRepository,
  onOpenCallCenter,
  onSearchRecruitment,
  onCreateRecruitmentLead,
  onSaveRecruitmentLead,
  onBackToHub,
  onBackToRecruitment
}) {
  if (page === 'recruitment-repository' && canManageRecruitment) {
    return (
      <RecruitmentRepositoryPage
        filters={recruitmentFilters}
        setFilters={setRecruitmentFilters}
        leads={recruitmentLeads}
        draft={recruitmentLeadDraft}
        setDraft={setRecruitmentLeadDraft}
        error={recruitmentLeadCreateError}
        saving={recruitmentLeadCreateSaving}
        onSearch={onSearchRecruitment}
        onCreateLead={onCreateRecruitmentLead}
        onBack={onBackToRecruitment}
      />
    );
  }

  if (page === 'recruitment-call-center' && canManageRecruitment) {
    return (
      <RecruitmentCallCenterPage
        filters={recruitmentFilters}
        setFilters={setRecruitmentFilters}
        leads={recruitmentLeads}
        onSearch={onSearchRecruitment}
        onSaveLead={onSaveRecruitmentLead}
        onBack={onBackToRecruitment}
        canManageRecruitment={canManageRecruitment}
      />
    );
  }

  return (
    <RecruitmentPage
      leads={recruitmentLeads}
      publicFormUrl={publicFormUrl}
      onOpenRepository={onOpenRepository}
      onOpenCallCenter={onOpenCallCenter}
      onBack={onBackToHub}
    />
  );
}
