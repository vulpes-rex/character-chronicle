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
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getLevelUpOptions } from '@/services/dnd-api';
import type { CharacterLevel } from '@/services/dnd-api';
import { WandSparkles } from 'lucide-react'; // Using WandSparkles for level up

// TODO: Get these from character state
const currentClassName = 'Fighter';
const currentLevel = 1;

export function LevelUpPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: levelUpData, isLoading, error, refetch } = useQuery<CharacterLevel, Error>({
    queryKey: ['levelUp', currentClassName, currentLevel],
    queryFn: () => getLevelUpOptions(currentClassName, currentLevel),
    enabled: isOpen, // Only fetch when the dialog is open
    staleTime: Infinity, // Data is considered fresh indefinitely unless invalidated
    gcTime: 300000, // Cache data for 5 minutes
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      refetch(); // Refetch when opened
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
         <Button variant="ghost" className="w-full justify-start gap-2">
            <WandSparkles />
            <span className="group-data-[collapsible=icon]:hidden">Level Up</span>
          </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Level Up Suggestions</DialogTitle>
          <DialogDescription>
            Available options for leveling up your {currentClassName} from level {currentLevel} to {currentLevel + 1}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-4 border rounded-md bg-secondary/30">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to fetch level up options: {error.message}
              </AlertDescription>
            </Alert>
          )}
          {levelUpData && !isLoading && !error && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Level {levelUpData.level} Features:</h3>
              {levelUpData.features.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {levelUpData.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No new features listed for this level according to the 2014 ruleset.</p>
              )}
               {/* Add more details like ability score improvements, spell slots etc. if applicable */}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
           {/* TODO: Add button to apply level up changes */}
           {/* <Button variant="default">Apply Level Up</Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
