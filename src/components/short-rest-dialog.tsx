'use client';

import { useState, useMemo, useEffect, useCallback } from 'react'; // Added useEffect, useCallback
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider'; // Using Slider for dice selection
import { HeartPulse } from 'lucide-react'; // Removed Dices
import type { HitPointsState, HitDiceState } from '@/lib/types'; // Corrected HitPoints import
import { useToast } from '@/hooks/use-toast';
import { calculateAbilityModifier } from '@/services/rules-service'; // Import calculator

interface ShortRestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  maxHitDice: number;
  currentHitDice: number;
  hitDieType: HitDiceState['dieType']; // Use correct type from HitDiceState
  constitutionScore: number; // Changed from modifier to score
  maxHp: number;
  currentHp: number;
  onConfirm: (hitDiceSpent: number, hpRecovered: number) => void;
  rollDiceFn: (diceString: string, label: string) => Promise<number>; // Updated signature to match performRoll
}

export function ShortRestDialog({
  isOpen,
  onOpenChange,
  maxHitDice,
  currentHitDice,
  hitDieType,
  constitutionScore, // Updated prop
  maxHp,
  currentHp,
  onConfirm,
  rollDiceFn,
}: ShortRestDialogProps) {
  const [diceToSpend, setDiceToSpend] = useState<number>(0);
  const [calculatedRecovery, setCalculatedRecovery] = useState<number>(0);
  const [isRolling, setIsRolling] = useState(false);
  const [constitutionModifier, setConstitutionModifier] = useState(0); // State for modifier
  const { toast } = useToast();

   // Calculate modifier when score changes
   useEffect(() => {
       const calculateMod = async () => {
           setConstitutionModifier(await calculateAbilityModifier(constitutionScore));
       };
       calculateMod();
   }, [constitutionScore]);

  const maxDiceCanSpend = useMemo(() => Math.min(currentHitDice, maxHitDice), [currentHitDice, maxHitDice]);

   // Reset state when dialog opens/closes
   useEffect(() => {
     if (!isOpen) {
       setDiceToSpend(0);
       setCalculatedRecovery(0);
       setIsRolling(false);
     }
   }, [isOpen]); // Depend only on isOpen

   const handleSliderChange = (value: number[]) => {
     setDiceToSpend(value[0]);
     setCalculatedRecovery(0); // Reset calculated recovery when slider changes
     setIsRolling(false); // Allow rolling again if slider changes
   };


  const handleRollHitDice = useCallback(async () => { // Make async and useCallback
      if (!hitDieType || diceToSpend <= 0) return;
      setIsRolling(true);

      let totalRecovered = 0;
      let rollsDescription = '';

      for (let i = 0; i < diceToSpend; i++) {
          // Use the passed rollDiceFn (which now uses dddice and logs)
          const roll = await rollDiceFn(hitDieType, `Hit Die #${i + 1}`);
          const recoveryThisDie = Math.max(0, roll + constitutionModifier); // Use state modifier
          totalRecovered += recoveryThisDie;
          rollsDescription += `${i > 0 ? ', ' : ''}${roll}`;
      }

       // Cap recovery at max HP
      const finalRecovery = Math.min(totalRecovered, maxHp - currentHp);
      setCalculatedRecovery(finalRecovery);

       // Toast is likely handled by the performRoll function, but keep a fallback just in case
      // toast({
      //     title: "Hit Dice Rolled",
      //     description: `Rolled ${diceToSpend} ${hitDieType}: [${rollsDescription}]. Base recovery: ${totalRecovered} HP. Actual recovery capped at ${finalRecovery} HP.`,
      // });
      setIsRolling(false); // Set rolling to false after completion
  }, [diceToSpend, hitDieType, rollDiceFn, constitutionModifier, maxHp, currentHp, toast]); // Include dependencies

   const handleConfirmRest = () => {
     // Confirmation happens even if 0 dice were rolled (to reset features)
     onConfirm(diceToSpend, calculatedRecovery);
     onOpenChange(false); // Close the dialog
   };


  const canConfirm = currentHitDice >= 0 && hitDieType !== null; // Can always confirm short rest, even with 0 dice

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Take a Short Rest</DialogTitle>
          <DialogDescription>
            Spend Hit Dice to recover Hit Points. Features that reset on a short rest will be refreshed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
            {currentHitDice > 0 && hitDieType ? (
                <>
                    <div className="space-y-2">
                      <Label htmlFor="hit-dice-slider" className="flex justify-between">
                         <span>Spend Hit Dice ({hitDieType}):</span>
                         <span className="font-bold text-lg">{diceToSpend} / {currentHitDice} available</span>
                       </Label>
                        <Slider
                         id="hit-dice-slider"
                         min={0}
                         max={maxDiceCanSpend}
                         step={1}
                         value={[diceToSpend]}
                         onValueChange={handleSliderChange}
                         disabled={isRolling}
                         aria-label="Number of hit dice to spend"
                       />
                    </div>
                     <Button
                         onClick={handleRollHitDice}
                         disabled={diceToSpend <= 0 || isRolling}
                         className="w-full"
                     >
                          {isRolling ? 'Rolling...' : `Roll ${diceToSpend} ${hitDieType}`}
                     </Button>

                     {calculatedRecovery > 0 && (
                         <Alert>
                             <HeartPulse className="h-4 w-4" />
                             <AlertTitle>HP Recovery</AlertTitle>
                             <AlertDescription>
                                 You will recover <span className="font-semibold">{calculatedRecovery}</span> Hit Points.
                             </AlertDescription>
                         </Alert>
                     )}
                     {diceToSpend > 0 && !isRolling && calculatedRecovery === 0 && (
                          <p className="text-sm text-muted-foreground text-center">Roll dice to see recovery amount.</p>
                      )}
                </>
            ) : (
                <Alert variant="destructive">
                   <AlertTitle>Cannot Spend Hit Dice</AlertTitle>
                   <AlertDescription>
                       {currentHitDice <= 0 ? 'You have no Hit Dice remaining.' : 'Character class/hit die not set.'}
                   </AlertDescription>
               </Alert>
            )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirmRest} disabled={!canConfirm}>
            Confirm Rest {calculatedRecovery > 0 ? `(+${calculatedRecovery} HP)` : ''}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

