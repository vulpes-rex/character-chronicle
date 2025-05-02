'use client';

import React, {useState, useCallback} from 'react';
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card, CardContent} from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Dices } from 'lucide-react';
import { rollDice } from '@/lib/types'; // Import rollDice utility

interface FloatingDiceRollerProps {
    onRoll: (rollString: string, result: number) => void; // Callback to send roll data to GameLog
}

const FloatingDiceRoller = ({ onRoll }: FloatingDiceRollerProps) => {
    const [numDiceD4, setNumDiceD4] = useState(0);
    const [numDiceD6, setNumDiceD6] = useState(0);
    const [numDiceD8, setNumDiceD8] = useState(0);
    const [numDiceD10, setNumDiceD10] = useState(0);
    const [numDiceD12, setNumDiceD12] = useState(0);
    const [numDiceD20, setNumDiceD20] = useState(0);
    const [modifier, setModifier] = useState(0);
    const [show, setShow] = useState(false);
    const { toast } = useToast();

    const rollDiceAndLog = useCallback(() => {
        let total = 0;
        let description = '';

        const addDiceRoll = (numDice: number, diceType: string, rollFunc: () => void) => {
            if (numDice > 0) {
                rollFunc();
                description += description.length > 0 ? ` + ${numDice}${diceType}` : `${numDice}${diceType}`;
            }
        };

        const rollD4 = () => {
            for (let i = 0; i < numDiceD4; i++) {
                total += Math.floor(Math.random() * 4) + 1;
            }
        };
        const rollD6 = () => {
            for (let i = 0; i < numDiceD6; i++) {
                total += Math.floor(Math.random() * 6) + 1;
            }
        };
        const rollD8 = () => {
            for (let i = 0; i < numDiceD8; i++) {
                total += Math.floor(Math.random() * 8) + 1;
            }
        };
        const rollD10 = () => {
            for (let i = 0; i < numDiceD10; i++) {
                total += Math.floor(Math.random() * 10) + 1;
            }
        };
        const rollD12 = () => {
            for (let i = 0; i < numDiceD12; i++) {
                total += Math.floor(Math.random() * 12) + 1;
            }
        };
        const rollD20 = () => {
            for (let i = 0; i < numDiceD20; i++) {
                total += Math.floor(Math.random() * 20) + 1;
            }
        };

        addDiceRoll(numDiceD4, "d4", rollD4);
        addDiceRoll(numDiceD6, "d6", rollD6);
        addDiceRoll(numDiceD8, "d8", rollD8);
        addDiceRoll(numDiceD10, "d10", rollD10);
        addDiceRoll(numDiceD12, "d12", rollD12);
        addDiceRoll(numDiceD20, "d20", rollD20);

        if (modifier !== 0) {
            total += modifier;
            description += description.length > 0 ? ` + ${modifier}` : `${modifier}`;
        }

        description = description.length > 0 ? description : 'No dice specified';

        // Call the onRoll callback to send the dice data upwards (to CombatTracker or similar)
        onRoll(description, total);

        toast({
            title: "Dice Roll",
            description: `${description} = ${total}`,
        });

    }, [numDiceD4, numDiceD6, numDiceD8, numDiceD10, numDiceD12, numDiceD20, modifier, onRoll, toast]);


    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            display: show ? 'block' : 'none',
        }}>
            <Card>
                <CardContent>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '8px',
                        boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
                    }}>
                        <div style={{display: 'flex', flexDirection: 'row', marginBottom: '10px'}}>
                           <div>
                                <Input
                                    type="number"
                                    value={numDiceD4}
                                    onChange={e => setNumDiceD4(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d4
                            </div>
                            <div>
                                <Input
                                    type="number"
                                    value={numDiceD6}
                                    onChange={e => setNumDiceD6(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d6
                            </div>
                             <div>
                                <Input
                                    type="number"
                                    value={numDiceD8}
                                    onChange={e => setNumDiceD8(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d8
                            </div>
                            <div>
                                <Input
                                    type="number"
                                    value={numDiceD10}
                                    onChange={e => setNumDiceD10(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d10
                            </div>
                            <div>
                                <Input
                                    type="number"
                                    value={numDiceD12}
                                    onChange={e => setNumDiceD12(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d12
                            </div>
                            <div>
                                <Input
                                    type="number"
                                    value={numDiceD20}
                                    onChange={e => setNumDiceD20(parseInt(e.target.value))}
                                    style={{width: '40px', marginRight: '5px'}}
                                    min="0"
                                />
                                d20
                            </div>
                            <div>
                                +
                                <Input
                                    type="number"
                                    value={modifier}
                                    onChange={e => setModifier(parseInt(e.target.value))}
                                    style={{width: '50px', marginLeft: '5px'}}
                                />
                            </div>
                        </div>

                        <Button variant={"outline"} onClick={rollDiceAndLog}>
                            <Dices className="mr-2 h-4 w-4" />
                            Roll Dice
                        </Button>
                        <Button variant={"secondary"} onClick={() => setShow(false)}>Close</Button>
                    </div>
                </CardContent>
            </Card>
            <Button
                variant="secondary"
                size="icon"
                style={{position: 'absolute', top: '-10px', right: '-10px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.8)'}}
                onClick={() => setShow(!show)}
            >
                {show ? 'Close' : 'Open'}
            </Button>
        </div>
    );
};

export {FloatingDiceRoller};
