'use client';

import type { GameLogEntry } from '@/lib/types'; // Use alias
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
import { formatDistanceToNow } from 'date-fns';

interface GameLogProps {
  entries: GameLogEntry[];
}

export function GameLog({ entries }: GameLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full pr-4">
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No log entries yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start space-x-3 text-sm">
                   {/* Timestamp */}
                    <span className="text-muted-foreground text-xs whitespace-nowrap w-20 pt-0.5">
                         {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                     </span>
                   <div className="flex-1">
                       {/* Actor */}
                        <span className="font-medium mr-1">{entry.actorName}:</span>
                        {/* Action */}
                        <span className="text-foreground/90">{entry.details}</span>
                        {/* Roll Details */}
                        {entry.rollDetails && (
                            <span className="text-muted-foreground ml-1 italic">
                                (Rolled {entry.rollDetails.dice} = {entry.rollDetails.result})
                            </span>
                        )}
                        {/* Spell Details */}
                        {entry.spellDetails && (
                             <span className="text-muted-foreground ml-1 italic">
                                (Cast {entry.spellDetails.name}, Lvl {entry.spellDetails.level})
                             </span>
                        )}
                   </div>

                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    