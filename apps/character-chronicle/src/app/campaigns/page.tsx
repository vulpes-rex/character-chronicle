
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignList } from '@/components/campaign-list'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
// We might need a way to get the current user's role here, possibly via a server context or hook
// For now, assume we can pass it down or CampaignList handles filtering based on fetched data

export default function CampaignsPage() {
  // Placeholder: Determine if user is DM. In a real app, get this from session/auth context.
  const isDM = true; // Replace with actual logic

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Campaigns</h1>
          {isDM && ( // Only show Create button to DMs
            <Button asChild>
              <Link href="/dm/campaigns/create">
                <ShieldCheck className="mr-2 h-4 w-4" /> Create New Campaign
              </Link>
            </Button>
          )}
        </div>
        {/* CampaignList component will fetch and display campaigns */}
        <CampaignList />
      </div>
    </AppLayout>
  );
}
