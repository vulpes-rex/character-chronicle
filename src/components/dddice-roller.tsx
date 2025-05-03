'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { DDDiceAPI, DiceRoll } from 'dddice-js'; // Assuming types are available
import { useDiceRoller } from './dice-roll-context'; // Import the context hook

export function DDDiceRoller() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [sdk, setSdk] = useState<DDDiceAPI | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [currentRollText, setCurrentRollText] = useState<string | null>(null);
    const [DDDiceModule, setDDDiceModule] = useState<typeof import('dddice-js') | null>(null);
    const [rollerKey, setRollerKey] = useState(0); // Key to help re-trigger initialization

    // Get visual roll request from context
    const { visualRollRequest } = useDiceRoller();

    // Load the module dynamically on the client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            import('dddice-js')
            .then(module => {
                setDDDiceModule(module);
                setRollerKey(prev => prev + 1);
            })
            .catch(err => {
                console.error("Failed to load dddice-js module:", err);
            });
        }
    }, []);

    // Initialize DDDice SDK
    useEffect(() => {
        if (!DDDiceModule?.DDDice || sdk || !canvasRef.current) {
             console.log("DDDice SDK initialization prerequisites not met:", { hasModule: !!DDDiceModule, hasConstructor: !!DDDiceModule?.DDDice, hasSdk: !!sdk, hasCanvas: !!canvasRef.current });
            return;
        }

        console.log("Attempting to initialize DDDice SDK...");
        const initializeDDDice = async () => {
            try {
                const roomSlug = 'character-chronicle-room';
                const DDDiceConstructor = DDDiceModule.DDDice;
                const diceSdk = new DDDiceConstructor(undefined, canvasRef.current);
                await diceSdk.connect(roomSlug);
                setSdk(diceSdk);
                console.log("DDDice SDK Initialized and Connected");
            } catch (error) {
                console.error('Failed to initialize DDDice SDK:', error);
            }
        };

        initializeDDDice();

        return () => {
            sdk?.disconnect();
            setSdk(null);
            console.log("DDDice SDK Disconnected");
        };
    }, [DDDiceModule, sdk, rollerKey]);

    // --- Trigger dddice roll based on context request ---
    useEffect(() => {
        if (sdk && visualRollRequest && DDDiceModule) {
            const { rollString, label } = visualRollRequest;
            setCurrentRollText(`${label} (${rollString})`); // Set the text to display

            try {
                 console.log(`DDDice: Received roll request - ${label}: ${rollString}`);
                // Simple parsing for dddice format (e.g., "1d20+5", "2d6")
                // Needs more robust parsing for complex rolls
                const diceParts = rollString.match(/(\d+)?d(\d+)([+\-]\d+)?/i);
                if (diceParts) {
                    const numDice = parseInt(diceParts[1] || '1', 10);
                    const numSides = parseInt(diceParts[2], 10);
                    const modifier = parseInt(diceParts[3] || '0', 10);

                    const dice: DiceRoll['dice'] = Array.from({ length: numDice }).map(() => ({
                         type: `d${numSides}` as any, // Cast needed as dddice types are specific
                         theme: 'dddice-standard', // Use your preferred theme
                         value: undefined // Value will be filled by the roll
                    }));

                     const rollPayload: DiceRoll[] = [{
                         dice: dice,
                         modifier: modifier,
                         // operator: [], // Add operators if needed
                     }];

                    console.log("DDDice: Rolling payload:", JSON.stringify(rollPayload));
                    sdk.roll(rollPayload);
                    setIsVisible(true);

                    const timer = setTimeout(() => setIsVisible(false), 5000); // Hide after 5 seconds
                    return () => clearTimeout(timer);

                } else {
                     console.warn(`DDDice: Could not parse dice notation: "${rollString}"`);
                     setIsVisible(false); // Hide if parsing fails
                }

            } catch (error) {
                console.error('DDDice: Error rolling dice:', error);
                setIsVisible(false); // Hide on error
            }
        } else {
             setIsVisible(false); // Hide if no request or SDK/Module not ready
        }
    // Use visualRollRequest.key as dependency to re-trigger on new requests
    }, [visualRollRequest?.key, sdk, DDDiceModule]);


    // Style the canvas container
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '80px', // Position above the manual roller
        left: '20px',
        width: '250px',
        height: '150px',
        zIndex: 999,
        transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        pointerEvents: isVisible ? 'auto' : 'none',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        backgroundColor: 'hsla(var(--card) / 0.7)',
    };

     const textStyle: React.CSSProperties = {
         position: 'absolute',
         bottom: '10px',
         left: '10px',
         right: '10px',
         color: 'hsl(var(--card-foreground))',
         fontSize: '12px',
         textAlign: 'center',
         backgroundColor: 'hsla(var(--muted) / 0.8)',
         padding: '4px',
         borderRadius: '4px',
         pointerEvents: 'none',
         textShadow: '1px 1px 2px hsla(var(--background) / 0.5)',
     };

    return (
        <div style={containerStyle}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
             {isVisible && currentRollText && (
                <div style={textStyle}>{currentRollText}</div>
             )}
        </div>
    );
}
