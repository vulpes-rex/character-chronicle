
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignList } from '@/components/campaign-list'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth-provider'; // Use alias for server-side auth check if possible

// Consider fetching user role server-side if possible for initial render check
// Example using a hypothetical server-side auth helper:
// import { getCurrentUserRole } from '@/lib/server-auth';

export default async function CampaignsPage() {
  // Placeholder: Determine if user is DM. In a real app, get this from session/auth context.
  // This check might be better inside AppLayout or middleware.
  // For now, simulate server-side check (this won't work directly like this):
  // const userRole = await getCurrentUserRole();
  // const isDM = userRole === 'dm';
  const isDM = true; // Replace with actual server-side logic or rely on client-side check in useAuth

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Campaigns</h1>
          {isDM && ( // Only show Create button to DMs based on server-side check if possible
            <Button asChild>
              <Link href="/dm/campaigns/create">
                <ShieldCheck className="mr-2 h-4 w-4" /> Create New Campaign
              </Link>
            </Button>
          )}
        </div>
        {/* CampaignList component will fetch and display campaigns using Server Actions */}
        <CampaignList />
      </div>
    </AppLayout>
  );
}

    