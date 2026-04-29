import {
  BloodDonorsRepositoryPage,
  BloodDrivePage,
  DonationLocationsPage,
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
  repositoryDonorError,
  donationLocationDraft,
  setDonationLocationDraft,
  allDonors,
  donationLocations,
  isAdmin,
  onOpenCollection,
  onOpenEligibleDonors,
  onOpenRepository,
  onOpenLocations,
  onExportDonations,
  onSearchEligible,
  onSearchRepository,
  onCreateRepositoryDonor,
  onCreateDonationLocation,
  onToggleDonationLocation,
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
        error={repositoryDonorError}
        onSearch={onSearchRepository}
        onCreateDonor={onCreateRepositoryDonor}
        onSaveDonor={onSaveDonor}
        onDeleteDonor={onDeleteDonor}
        onBack={onBackToBloodDrive}
        isAdmin={isAdmin}
      />
    );
  }

  if (page === 'donation-locations' && isAdmin) {
    return (
      <DonationLocationsPage
        locations={donationLocations}
        draft={donationLocationDraft}
        setDraft={setDonationLocationDraft}
        onCreateLocation={onCreateDonationLocation}
        onToggleLocation={onToggleDonationLocation}
        onBack={onBackToBloodDrive}
      />
    );
  }

  return (
    <BloodDrivePage
      donorStats={donorStats}
      onOpenCollection={onOpenCollection}
      onOpenEligibleDonors={onOpenEligibleDonors}
      onOpenRepository={onOpenRepository}
      onOpenLocations={onOpenLocations}
      onExportDonations={onExportDonations}
      onBack={onBackToHub}
      isAdmin={isAdmin}
    />
  );
}
