
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignDetails } from '@/components/campaign-details'; // Use alias

interface PlayerCampaignViewPageProps {
  params: { campaignId: string };
}

// This page should likely be protected and only accessible to players in the campaign.
// Authentication and authorization checks should be performed.

export default function PlayerCampaignViewPage({ params }: PlayerCampaignViewPageProps) {
  const { campaignId } = params;

  return (
    <AppLayout>
      {/* CampaignDetails will fetch and display campaign info, character list, game log */}
      {/* It should use Server Actions for data fetching */}
      <CampaignDetails campaignId={campaignId} mode="player" />
    </AppLayout>
  );
}

    