
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignDetails } from '@/components/campaign-details'; // Use alias

interface DMCampaignManagePageProps {
  params: { campaignId: string };
}

// This page should likely be protected and only accessible to the DM of the campaign.

export default function DMCampaignManagePage({ params }: DMCampaignManagePageProps) {
  const { campaignId } = params;

  return (
    <AppLayout>
      {/* CampaignDetails will fetch and display campaign info, character list, game log, and DM controls */}
      <CampaignDetails campaignId={campaignId} mode="dm" />
    </AppLayout>
  );
}
