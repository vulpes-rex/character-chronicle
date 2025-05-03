
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CombatTracker, CombatTrackerSkeleton } from '@/components/combat-tracker'; // Use alias
import { loadEncounterAction } from '@/app/actions/encounter-actions'; // Use Server Action
import { loadCampaignAction, getCombinedContentFromPacksAction } from '@/app/actions/campaign-actions'; // Use Server Actions
import { loadCharacterAction } from '@/app/actions/character-actions'; // Use Server Action
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';
import type { Encounter, Campaign, Character, Monster, NPC } from '@/lib/types'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias

interface RunEncounterPageProps {
  params: { id: string };
}

// Fetch necessary data server-side using Server Actions
async function getEncounterDataForRun(encounterId: string) {
    let encounter: Encounter | null = null;
    let campaign: Campaign | null = null;
    let characters: Character[] = [];
    let monsters: Array<{ instanceId: string; definition?: Monster }> = [];
    let npcs: Array<{ instanceId: string; definition?: NPC }> = [];

    try {
        // Load Encounter
        const encounterResult = await loadEncounterAction(encounterId);
        if (!encounterResult.success || !encounterResult.encounter) {
            throw new Error(encounterResult.error || `Encounter with ID "${encounterId}" not found.`);
        }
        encounter = encounterResult.encounter;

        // Load Campaign
        const campaignResult = await loadCampaignAction(encounter.campaignId);
        if (!campaignResult.success || !campaignResult.campaign) {
            throw new Error(campaignResult.error || `Campaign with ID "${encounter.campaignId}" not found for this encounter.`);
        }
        campaign = campaignResult.campaign;

        // TODO: Perform DM permission check here using server session/auth context
        // const currentUserId = await getCurrentUserId(); // Hypothetical function
        // if (campaign.dmId !== currentUserId) {
        //    throw new Error("Permission denied: You are not the DM of this campaign.");
        // }


        // Fetch character details concurrently
        const characterPromises = encounter.participants
            .filter(p => p.type === 'character')
            .map(async (p) => {
                const result = await loadCharacterAction(p.sourceId);
                if (!result.success || !result.character) {
                    console.warn(`[RunEncounter] Failed to load character ${p.sourceId}:`, result.error);
                    return null; // Return null if a single character fails to load
                }
                return result.character;
            });
        characters = (await Promise.all(characterPromises)).filter((c): c is Character => c !== null);


        // Fetch combined content from active source packs
        const combinedContentResult = await getCombinedContentFromPacksAction(campaign.activeSourcePackIds || ['srd']);
        if (!combinedContentResult.success || !combinedContentResult.content) {
            // Handle error fetching content - maybe proceed with only characters?
            console.error("[RunEncounter] Error loading combined content:", combinedContentResult.error);
            // Decide on fallback behavior - throw error or continue partially
            throw new Error(combinedContentResult.error || "Failed to load monster/NPC definitions.");
        }
        const combinedContent = combinedContentResult.content;

        // Process Monsters using combined content
        monsters = encounter.participants
            .filter(p => p.type === 'monster')
            .map(p => {
                 const definition = combinedContent.monsters?.[p.sourceId];
                 if (!definition) {
                    console.warn(`[RunEncounter] Monster definition not found for source ID "${p.sourceId}" in active packs.`);
                 }
                 return {
                    instanceId: p.id,
                    definition: definition // May be undefined if not found
                 };
            });

        // Process NPCs using combined content
         npcs = encounter.participants
            .filter(p => p.type === 'npc')
            .map(p => {
                 const definition = combinedContent.npcs?.[p.sourceId];
                 if (!definition) {
                    console.warn(`[RunEncounter] NPC definition not found for source ID "${p.sourceId}" in active packs.`);
                 }
                 return {
                    instanceId: p.id,
                    definition: definition // May be undefined if not found
                 };
            });


        return { success: true, encounter, campaign, characters, monsters, npcs }; // Include NPCs in return

    } catch (error: any) {
        console.error("[RunEncounter] Error loading data for encounter run:", error);
        // Return a specific error object instead of throwing to allow graceful handling in the component
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred while loading encounter data.' };
    }
}


export default async function RunEncounterPage({ params }: RunEncounterPageProps) {
  const { id: encounterId } = params;

  // Fetch data using the server-side function that calls Server Actions
  const dataResult = await getEncounterDataForRun(encounterId);

  if (!dataResult.success) {
      return (
          <AppLayout>
              <div className="p-4 md:p-6">
                  <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error Loading Encounter Data</AlertTitle>
                      <AlertDescription>{dataResult.error || 'Failed to load encounter data. The encounter might not exist or there was a server issue.'}</AlertDescription>
                  </Alert>
              </div>
          </AppLayout>
      );
  }

   // Data fetching successful, proceed to render CombatTracker
   const { encounter, campaign, characters, monsters, npcs } = dataResult; // Destructure npcs

  return (
    <AppLayout>
        {/* CombatTracker will handle the state and interactions for the running encounter */}
        {/* It will use Server Actions for updates (e.g., initiative, HP, status) */}
        <CombatTracker
            initialEncounter={encounter}
            campaign={campaign}
            characters={characters}
            monsters={monsters}
            npcs={npcs} // Pass NPCs to the tracker
        />
    </AppLayout>
  );
}

    