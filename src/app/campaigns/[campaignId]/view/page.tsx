
import { AppLayout } from '@/components/app-layout';
import { CampaignDetails } from '@/components/campaign-details'; // New component

interface PlayerCampaignViewPageProps {
  params: { campaignId: string };
}

// This page should likely be protected and only accessible to players in the campaign.

export default function PlayerCampaignViewPage({ params }: PlayerCampaignViewPageProps) {
  const { campaignId } = params;

  return (
    <AppLayout>
      {/* CampaignDetails will fetch and display campaign info, character list, game log */}
      <CampaignDetails campaignId={campaignId} mode="player" />
    </AppLayout>
  );
}
