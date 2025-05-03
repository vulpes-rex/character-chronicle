'use client';

import { useEffect, useRef } from 'react';
import type DDDice from 'dddice-js'; // Use type import

// Lazy load dddice-js module only on the client-side
let DDDiceModule: typeof DDDice | null = null;
if (typeof window !== 'undefined') {
     import('dddice-js').then(module => {
        DDDiceModule = module.default; // Assuming dddice-js uses default export
     }).catch(err => {
         console.error("Failed to load dddice-js module:", err);
     });
}


export function DDDiceLoader() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dddiceRef = useRef<DDDice | null>(null);

    useEffect(() => {
        if (!DDDiceModule || !canvasRef.current || dddiceRef.current) {
             console.log("DDDice Loader: Conditions not met or already initialized.", { DDDiceModule: !!DDDiceModule, canvasRef: !!canvasRef.current, dddiceRef: !!dddiceRef.current });
            return; // Only initialize once and if module is loaded
        }

        console.log("DDDice Loader: Initializing...");
        try {
             const dddice = new DDDiceModule(canvasRef.current, {
                 diceTheme: 'dddice-standard', // Example theme
                 // Add other config options as needed
                  assetPath: '/dddice/assets/', // Ensure this path is correct
                  gravity: 20,
                  scale: 7,
                  lightIntensity: 1,
                  offscreen: true, // Recommended for performance
                  enableShadows: true,
             });
             dddiceRef.current = dddice;

             // Add any initialization listeners if needed
             // dddice.connect(); // Connect if using rooms

            console.log("DDDice Loader: Initialized successfully.");

             // Optional: Test roll on init
             // setTimeout(() => {
             //     dddice.roll([{ type: 'd20', theme: 'dddice-standard' }]);
             // }, 1000);


        } catch (error) {
            console.error("Error initializing DDDice:", error);
        }

         // Cleanup function
         return () => {
             if (dddiceRef.current) {
                 console.log("DDDice Loader: Cleaning up...");
                 // dddiceRef.current.disconnect(); // Disconnect if connected
                 // Perform any other necessary cleanup
                 dddiceRef.current = null;
             }
         };
    }, []); // Empty dependency array ensures this runs only once on mount

    return <canvas ref={canvasRef} id="dddice-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }} />;
}
