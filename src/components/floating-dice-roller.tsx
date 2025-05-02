'use client';

import React, {useState, useRef, useEffect} from 'react';
import Dice from 'react-dice-complete';
import 'react-dice-complete/dist/react-dice-complete.css';
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card, CardContent} from "@/components/ui/card";
import {Dices} from "lucide-react";

const FloatingDiceRoller = () => {
    const [numDice, setNumDice] = useState(1);
    const [sides, setSides] = useState(6);
    const [modifier, setModifier] = useState(0);
    const [roll, setRoll] = useState(0);
    const [show, setShow] = useState(false);
    const diceRef = useRef<Dice>(null);

    useEffect(() => {
        // Initialize dice roll if component is visible
        if (show && diceRef.current) {
            rollDice();
        }
    }, [show]);

    const rollDice = () => {
        if (diceRef.current) {
            diceRef.current.rollAll();
        }
    };

    const onRollDone = () => {
        let total = 0;
        if (diceRef.current) {
            total = diceRef.current.diceResults.reduce((a, b) => a + b, 0) + modifier;
        }
        setRoll(total);
    };

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
                            <Input
                                type="number"
                                value={numDice}
                                onChange={e => setNumDice(parseInt(e.target.value))}
                                style={{width: '50px', marginRight: '5px'}}
                                min="1"
                            />
                            d
                            <Input
                                type="number"
                                value={sides}
                                onChange={e => setSides(parseInt(e.target.value))}
                                style={{width: '50px', marginLeft: '5px'}}
                                min="1"
                            />
                            +
                            <Input
                                type="number"
                                value={modifier}
                                onChange={e => setModifier(parseInt(e.target.value))}
                                style={{width: '50px', marginLeft: '5px'}}
                            />
                        </div>

                        <div style={{marginBottom: '10px'}}>
                            <Dice
                                numDice={numDice}
                                sides={sides}
                                ref={diceRef}
                                rollDoneCallback={onRollDone}
                                // DieComponent={Die}
                            />
                        </div>

                        <Button variant={"outline"} onClick={rollDice}>Roll</Button>

                        {roll > 0 && (
                            <div style={{marginTop: '10px', fontSize: '1.2em'}}>
                                Result: {roll}
                            </div>
                        )}
                        <Button variant={"secondary"} onClick={() => setShow(false)}>Close</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export {FloatingDiceRoller};
