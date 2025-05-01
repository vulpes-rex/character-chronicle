
'use client';

import { useEffect, useRef, useState } from 'react';
import type { DDDiceAPI } from 'dddice-js'; // Assuming types are available

interface DDDiceRollerProps {
    resultText: string | null; // Text to display alongside the dice
}

export function DDDiceRoller({ resultText }: DDDiceRollerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [sdk, setSdk] = useState<DDDiceAPI | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // State hook for the dynamically imported module
    const [DDDiceModule, setDDDiceModule] = useState<typeof import('dddice-js') | null>(null);
    const [rollerKey, setRollerKey] = useState(0); // To force re-render of roller

    // Load the module dynamically on the client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Ensure dddice-js is imported dynamically only on the client-side
            import('dddice-js') // <-- Uncommented this line
            .then(module => {
                setDDDiceModule(module);
                 // Increment rollerKey to potentially help re-initialization if needed
                setRollerKey(prev => prev + 1);
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
                // Initialize SDK - replace 'YOUR_API_KEY' if required by DDDice for certain features
                const diceSdk = new DDDiceModule.DDDice(/* 'YOUR_API_KEY' */);

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
    }, [sdk, DDDiceModule, rollerKey]); // Rerun initialization if module reloads

    useEffect(() => {
        // Ensure SDK and Module are ready before attempting to roll
        if (sdk && resultText && DDDiceModule) {
            // Extract dice notation from resultText (basic example)
            const diceMatch = resultText.match(/Rolled\s+([\d\w\s\+\-d]+?)(?:\s*[:\(])/i);
             let diceNotation = diceMatch?.[1]?.trim() ?? '1d20'; // Default if extraction fails

             // Basic validation/cleanup: remove extra text if needed (can be improved)
             if (!/^\d*d\d+(\s*[+-]\s*\d+)?$/.test(diceNotation)) {
                 const simplerMatch = diceNotation.match(/(\d*d\d+)/i);
                 diceNotation = simplerMatch?.[1] ?? '1d20';
             }

            // Attempt to roll the dice
             try {
                 console.log(`Rolling dddice: ${diceNotation}`);
                 // Use a standard theme if available
                 sdk.roll([{ type: 'dice', theme: 'dddice-standard', options: { throw: true }, dice: [{ type: diceNotation }] }]);
                 setIsVisible(true);

                 // Hide after a delay
                 const timer = setTimeout(() => {
                     setIsVisible(false);
                 }, 5000); // Hide after 5 seconds

                 return () => clearTimeout(timer);
             } catch (error) {
                  console.error('Error rolling dice with DDDice SDK:', error);
             }
        } else {
            setIsVisible(false); // Hide if no result text or SDK/Module not ready
        }
    }, [resultText, sdk, DDDiceModule]); // Rerun when resultText, sdk or DDDiceModule changes

    // Style the canvas container
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '250px', // Adjust size as needed
        height: '150px',
        zIndex: 1000, // Ensure it's above other elements
        transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)', // Slide in/out effect
        pointerEvents: isVisible ? 'auto' : 'none', // Allow interaction only when visible
        borderRadius: '8px',
        overflow: 'hidden', // Clip canvas if needed
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(5px)', // Optional blur effect
        backgroundColor: 'hsla(var(--background) / 0.7)', // Use HSL with alpha
    };

     const textStyle: React.CSSProperties = {
         position: 'absolute',
         bottom: '10px',
         left: '10px',
         right: '10px',
         color: 'hsl(var(--foreground))', // Use theme foreground color
         fontSize: '12px',
         textAlign: 'center',
         backgroundColor: 'hsla(var(--card) / 0.5)', // Use card background with alpha for contrast
         padding: '4px',
         borderRadius: '4px',
         pointerEvents: 'none', // Text shouldn't block canvas interaction
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

