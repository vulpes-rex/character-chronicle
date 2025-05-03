'use client';

import { useEffect, useRef, useState } from 'react';
import type { DDDiceAPI, DiceRoll } from 'dddice-js'; // Assuming types are available
import { rollDice } from '@/lib/types'; // Import rollDice for fallback/comparison if needed

interface DDDiceRollerProps {
    resultText: string | null; // Text to display alongside the dice (e.g., "Attack Roll: 15 (1d20+5)")
}

export function DDDiceRoller({ resultText }: DDDiceRollerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [sdk, setSdk] = useState<DDDiceAPI | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // State hook for the dynamically imported module
    const [DDDiceModule, setDDDiceModule] = useState<typeof import('dddice-js') | null>(null);

    // Load the module dynamically on the client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Ensure dddice-js is imported dynamically only on the client-side
            import('dddice-js')
            .then(module => {
                setDDDiceModule(module);
            })
            .catch(err => {
                console.error("Failed to load dddice-js module:", err);
                // Handle the error appropriately, maybe show a message or disable the feature
            });
        }
    }, []); // Empty dependency array ensures this runs once on mount

    useEffect(() => {
        // Ensure DDDiceModule is loaded before trying to initialize
        if (!DDDiceModule || sdk || !canvasRef.current) return; // Don't initialize if already done, module not loaded, or canvas not ready

        console.log("Attempting to initialize DDDice SDK...");
        const initializeDDDice = async () => {
            try {
                // Replace with your actual room slug if needed
                const roomSlug = 'character-chronicle-room'; // Use a generic or configurable room slug
                // Initialize SDK - Use API Key if needed
                // const diceSdk = new DDDiceModule.DDDice('YOUR_API_KEY');
                const diceSdk = new DDDiceModule.DDDice(); // Initialize without API key for basic use

                // Pass the canvas element directly
                await diceSdk.connect(roomSlug, undefined, canvasRef.current);
                setSdk(diceSdk);
                console.log("DDDice SDK Initialized");
            } catch (error) {
                console.error('Failed to initialize DDDice SDK:', error);
                // Optionally show an error message to the user
            }
        };

        initializeDDDice();

        // Cleanup function
        return () => {
            sdk?.disconnect();
            setSdk(null);
            console.log("DDDice SDK Disconnected");
        };
    // Add sdk and DDDiceModule to dependency array
    }, [sdk, DDDiceModule]); // Rerun initialization if module reloads or sdk changes


    // --- Dice Rolling Logic ---
     useEffect(() => {
         if (sdk && resultText && DDDiceModule) {
             // Attempt to parse the dice notation from the resultText
             const match = resultText.match(/\((\d+d\d+(?:[+\-]\d+)?)\)/); // Look for (XdY+Z)
             const diceNotation = match ? match[1] : null;

             if (diceNotation) {
                 try {
                      console.log(`Rolling dddice with notation: ${diceNotation}`);
                     // Use the parsed dice notation directly
                     const roll: DiceRoll = {
                         dice: [{ type: diceNotation, theme: 'dddice-standard' }], // Use standard theme
                         // operator: [], // Operators if needed based on notation parsing
                     };
                      // Use the SDK's roll method
                      sdk.roll([roll]);
                     setIsVisible(true);

                     // Hide after a delay
                     const timer = setTimeout(() => setIsVisible(false), 5000);
                     return () => clearTimeout(timer);
                 } catch (error) {
                     console.error('Error rolling dice with DDDice SDK:', error);
                 }
             } else {
                 console.warn(`Could not parse dice notation from result text: "${resultText}"`);
                  setIsVisible(false); // Hide if no valid dice found
             }
         } else {
             setIsVisible(false); // Hide if no result text or SDK/Module not ready
         }
     }, [resultText, sdk, DDDiceModule]); // Rerun when resultText, sdk or DDDiceModule changes


    // Style the canvas container
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '80px', // Adjust position to avoid overlap with manual roller button
        left: '20px',
        width: '250px', // Adjust size as needed
        height: '150px',
        zIndex: 999, // Slightly lower than the manual roller button
        transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)', // Slide in/out effect
        pointerEvents: isVisible ? 'auto' : 'none', // Allow interaction only when visible
        borderRadius: '8px',
        overflow: 'hidden', // Clip canvas if needed
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        // backdropFilter: 'blur(5px)', // Optional blur effect
        backgroundColor: 'hsla(var(--card) / 0.7)', // Use HSL with alpha
    };

     const textStyle: React.CSSProperties = {
         position: 'absolute',
         bottom: '10px',
         left: '10px',
         right: '10px',
         color: 'hsl(var(--card-foreground))', // Use theme foreground color
         fontSize: '12px',
         textAlign: 'center',
         backgroundColor: 'hsla(var(--muted) / 0.8)', // Use card background with alpha for contrast
         padding: '4px',
         borderRadius: '4px',
         pointerEvents: 'none', // Text shouldn't block canvas interaction
         textShadow: '1px 1px 2px hsla(var(--background) / 0.5)', // Add subtle shadow
     };

    return (
        <div style={containerStyle}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
             {isVisible && resultText && (
                <div style={textStyle}>{resultText}</div>
             )}
        </div>
    );
}
