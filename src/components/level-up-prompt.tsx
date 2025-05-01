'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getLevelUpOptions } from '@/services/dnd-api';
import type { CharacterLevel } from '@/services/dnd-api';
import { WandSparkles } from 'lucide-react'; // Using WandSparkles for level up

// TODO: Get these from character state/props
const currentClassName = 'Fighter'; // Example value
const currentLevel = 1;       // Example value

export function LevelUpPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const targetLevel = currentLevel + 1;

  // Fetch options specifically for the *next* level
  const { data: levelUpData, isLoading, error, refetch } = useQuery<CharacterLevel, Error>({
    queryKey: ['levelUp', currentClassName, targetLevel], // Use targetLevel in key
    queryFn: () => getLevelUpOptions(currentClassName, targetLevel), // Pass targetLevel to API call
    enabled: isOpen && !!currentClassName && currentLevel > 0, // Only fetch when open and class/level are valid
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 mins
    gcTime: 10 * 60 * 1000, // Cache data for 10 minutes
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && currentClassName && currentLevel > 0) {
      refetch(); // Refetch when opened if valid class/level
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
         <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            disabled={!currentClassName || currentLevel <= 0} // Disable if no class/level selected
            title={!currentClassName || currentLevel <= 0 ? "Select a class and level first" : "Get Level Up Suggestions"}
          >
            <WandSparkles />
            <span className="group-data-[collapsible=icon]:hidden">Level Up</span>
          </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Level Up Suggestions</DialogTitle>
          {currentClassName && currentLevel > 0 ? (
            <DialogDescription>
              Available options for leveling up your {currentClassName} from level {currentLevel} to {targetLevel}.
            </DialogDescription>
          ) : (
             <DialogDescription className='text-destructive'>
              Please select a class and ensure level is set on the character sheet first.
            </DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-4 border rounded-md bg-secondary/30 min-h-[150px]">
           {!currentClassName || currentLevel <= 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Select a class and level on the main sheet.</p>
            ) : isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to fetch level up options: {error.message}
              </AlertDescription>
            </Alert>
          ) : levelUpData ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Level {levelUpData.level} Features:</h3>
              {levelUpData.features.length > 0 ? (
                <ul className="list-disc space-y-3 pl-5 text-sm">
                  {levelUpData.features.map((feature, index) => (
                    <li key={index}>
                      <strong className="font-medium text-foreground">{feature.name}:</strong>
                      <p className="text-muted-foreground ml-2">{feature.description}</p>
                     </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No new specific class features listed for this level according to the basic ruleset data.</p>
              )}
              {levelUpData.proficiencyBonus && (
                <p className="text-sm">
                    <strong className="font-medium text-foreground">Proficiency Bonus:</strong> +{levelUpData.proficiencyBonus}
                </p>
              )}
               {/* TODO: Add details about spell slots, ability score improvements etc. */}
               {/* Example: Display ASI availability */}
               {[4, 8, 12, 16, 19].includes(levelUpData.level) && (
                 <p className="text-sm mt-2 font-semibold text-primary">Ability Score Improvement available at this level!</p>
               )}
            </div>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
           {/* TODO: Add button to apply level up changes - this would update the character's level state */}
           {levelUpData && <Button variant="default" disabled>Apply Level Up (Not Implemented)</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
