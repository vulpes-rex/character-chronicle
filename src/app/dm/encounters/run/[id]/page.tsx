
import { AppLayout } from '@/components/app-layout';
import { CombatTracker, CombatTrackerSkeleton } from '@/components/combat-tracker'; // Import skeleton
import { loadEncounter } from '@/services/encounter-service';
import { loadCampaign } from '@/services/campaign-service';
import { loadCharacter } from '@/services/character-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { Encounter, Campaign, Character, Monster } from '@/lib/types';
import { getCombinedContentFromPacks } from '@/services/campaign-service'; // To get monster definitions
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state

interface RunEncounterPageProps {
  params: { id: string };
}

// Fetch necessary data server-side
async function getEncounterData(encounterId: string) {
    let encounter: Encounter | null = null;
    let campaign: Campaign | null = null;
    let characters: Character[] = [];
    let monsters: Array<{ instanceId: string; definition?: Monster }> = [];

    try {
        encounter = await loadEncounter(encounterId);
        if (!encounter) throw new Error(`Encounter with ID "${encounterId}" not found.`);

        campaign = await loadCampaign(encounter.campaignId);
        if (!campaign) throw new Error(`Campaign with ID "${encounter.campaignId}" not found for this encounter.`);

        // Fetch character details
        try {
            const characterPromises = encounter.participants
                .filter(p => p.type === 'character')
                .map(p => loadCharacter(p.sourceId).catch(err => {
                    console.warn(`Failed to load character ${p.sourceId}:`, err);
                    return null; // Return null if a single character fails to load
                }));
            characters = (await Promise.all(characterPromises)).filter((c): c is Character => c !== null);
        } catch (error: any) {
            console.error("Error loading characters for encounter:", error);
            throw new Error(`Failed to load character details: ${error.message}`);
        }

        // Fetch monster definitions from active source packs
        try {
            const combinedContent = await getCombinedContentFromPacks(campaign.activeSourcePackIds || ['srd']);
            monsters = encounter.participants
                .filter(p => p.type === 'monster')
                .map(p => {
                     const definition = combinedContent.monsters?.[p.sourceId];
                     if (!definition) {
                        console.warn(`Monster definition not found for source ID "${p.sourceId}" in active packs.`);
                     }
                     return {
                        instanceId: p.id,
                        definition: definition // May be undefined if not found
                     };
                });
               // Optionally filter out monsters whose definitions weren't found, or handle them in the tracker
               // monsters = monsters.filter(m => m.definition);

        } catch (error: any) {
             console.error("Error loading combined content/monsters for encounter:", error);
            throw new Error(`Failed to load monster definitions: ${error.message}`);
        }

        return { encounter, campaign, characters, monsters };

    } catch (error: any) {
        console.error("Error loading data for encounter run:", error);
        // Return a specific error object instead of throwing to allow graceful handling in the component
        return { error: error instanceof Error ? error.message : 'An unknown error occurred while loading encounter data.' };
    }
}


export default async function RunEncounterPage({ params }: RunEncounterPageProps) {
  const { id: encounterId } = params;

  // It's generally better to fetch data within the component using hooks for client components,
  // but since this is a Server Component, we fetch directly.
  // We introduce a loading state visually, although the page itself won't render until data is fetched or errors.
  const data = await getEncounterData(encounterId);

  // TODO: Add permission check server-side: Ensure current user is the DM of the campaign (data.campaign?.dmId)
  // This requires accessing user session data on the server.

  if (data === null || 'error' in data) {
      return (
          <AppLayout>
              <div className="p-4 md:p-6">
                  <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error Loading Encounter Data</AlertTitle>
                      <AlertDescription>{data?.error || 'Failed to load encounter data. The encounter might not exist or there was a server issue.'}</AlertDescription>
                  </Alert>
              </div>
          </AppLayout>
      );
  }

   // Data fetching successful, proceed to render CombatTracker
   const { encounter, campaign, characters, monsters } = data;

  return (
    <AppLayout>
        {/* CombatTracker will handle the state and interactions for the running encounter */}
        <CombatTracker
            initialEncounter={encounter}
            campaign={campaign}
            characters={characters}
            monsters={monsters}
        />
    </AppLayout>
  );
}

// Optional: Add a loading component or integrate skeleton into the main return if needed
// function LoadingSkeleton() {
//    return (
//       <AppLayout>
//          <CombatTrackerSkeleton />
//       </AppLayout>
//    );
// }

    