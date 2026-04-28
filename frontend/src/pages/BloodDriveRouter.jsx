import {
  BloodDonorsRepositoryPage,
  BloodDrivePage,
  EligibleDonorsPage
} from './blood-drive';

export default function BloodDriveRouter({
  page,
  donorStats,
  donorFilters,
  setDonorFilters,
  eligibleDonors,
  repositoryFilters,
  setRepositoryFilters,
  repositoryDonorDraft,
  setRepositoryDonorDraft,
  allDonors,
  isAdmin,
  onOpenCollection,
  onOpenEligibleDonors,
  onOpenRepository,
  onSearchEligible,
  onSearchRepository,
  onCreateRepositoryDonor,
  onSaveDonor,
  onSaveEligibleDonor,
  onMarkEligibleDonorAsDonated,
  onDeleteDonor,
  onBackToHub,
  onBackToBloodDrive
}) {
  if (page === 'eligible-donors') {
    return (
      <EligibleDonorsPage
        donorFilters={donorFilters}
        setDonorFilters={setDonorFilters}
        eligibleDonors={eligibleDonors}
        onSearch={onSearchEligible}
        onSaveDonor={onSaveEligibleDonor}
        onMarkDonated={onMarkEligibleDonorAsDonated}
        onBack={onBackToBloodDrive}
        isAdmin={true}
      />
    );
  }

  if (page === 'repository') {
    return (
      <BloodDonorsRepositoryPage
        donors={allDonors}
        filters={repositoryFilters}
        setFilters={setRepositoryFilters}
        draft={repositoryDonorDraft}
        setDraft={setRepositoryDonorDraft}
        onSearch={onSearchRepository}
        onCreateDonor={onCreateRepositoryDonor}
        onSaveDonor={onSaveDonor}
        onDeleteDonor={onDeleteDonor}
        onBack={onBackToBloodDrive}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <BloodDrivePage
      donorStats={donorStats}
      onOpenCollection={onOpenCollection}
      onOpenEligibleDonors={onOpenEligibleDonors}
      onOpenRepository={onOpenRepository}
      onBack={onBackToHub}
    />
  );
}
