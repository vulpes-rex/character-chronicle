
'use client';

import { useEffect, useRef, useState } from 'react';
import type { DDDiceAPI } from 'dddice-js'; // Assuming types are available

// Lazy load the DDDice SDK
let DDDice: typeof import('dddice-js') | null = null;
if (typeof window !== 'undefined') {
    import('dddice-js').then(module => {
        DDDice = module;
    });
}

interface DDDiceRollerProps {
    resultText: string | null; // Text to display alongside the dice
    //apiKey: string; // Add API key if needed for specific features
}

export function DDDiceRoller({ resultText }: DDDiceRollerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [sdk, setSdk] = useState<DDDiceAPI | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!DDDice || sdk) return; // Don't initialize if already done or SDK not loaded

        const initializeDDDice = async () => {
            try {
                // Replace with your actual room slug if needed
                const roomSlug = 'your-room-slug'; // Or generate dynamically/get from user
                // Initialize SDK - replace 'YOUR_API_KEY' if required by DDDice for certain features
                const diceSdk = new DDDice.DDDice(/* 'YOUR_API_KEY' */);

                await diceSdk.connect(roomSlug, undefined, canvasRef.current ?? undefined);
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
    }, [DDDice, sdk]); // Dependency on DDDice ensures re-run if lazy loading finishes after initial mount

    useEffect(() => {
        if (sdk && resultText) {
            // Extract dice notation from resultText (basic example)
            const diceMatch = resultText.match(/(\d*d\d+(\s*[+-]\s*\d+)?)/i);
            const diceNotation = diceMatch ? diceMatch[1].replace(/\s/g, '') : '1d20'; // Default to 1d20 if no match

            // Attempt to roll the dice
             try {
                 console.log(`Rolling dddice: ${diceNotation}`);
                 sdk.roll(diceNotation); // Roll the extracted dice
                 setIsVisible(true);

                 // Hide after a delay
                 const timer = setTimeout(() => {
                     setIsVisible(false);
                     // Consider clearing canvas or stopping animation if possible via SDK
                 }, 5000); // Hide after 5 seconds

                 return () => clearTimeout(timer);
             } catch (error) {
                  console.error('Error rolling dice with DDDice SDK:', error);
             }
        } else {
            setIsVisible(false); // Hide if no result text or SDK not ready
        }
    }, [resultText, sdk]); // Rerun when resultText or SDK changes

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
        backgroundColor: 'rgba(var(--background-rgb, 0, 0, 0), 0.7)', // Use theme background with transparency
    };

     const textStyle: React.CSSProperties = {
         position: 'absolute',
         bottom: '10px',
         left: '10px',
         right: '10px',
         color: 'hsl(var(--foreground))', // Use theme foreground color
         fontSize: '12px',
         textAlign: 'center',
         backgroundColor: 'rgba(var(--background-rgb, 0, 0, 0), 0.5)',
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
