'use client';

import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';

interface VisualRollRequest {
    rollString: string;
    label: string;
    key: number; // To trigger effect even if string/label are the same
}

interface DiceRollContextType {
    visualRollRequest: VisualRollRequest | null;
    triggerVisualRoll: (rollString: string, label: string) => void;
}

const DiceRollContext = createContext<DiceRollContextType | undefined>(undefined);

export const DiceRollProvider = ({ children }: { children: React.ReactNode }) => {
    const [visualRollRequest, setVisualRollRequest] = useState<VisualRollRequest | null>(null);
    const [rollKey, setRollKey] = useState(0);

    const triggerVisualRoll = useCallback((rollString: string, label: string) => {
        setRollKey(prev => prev + 1); // Increment key to ensure effect triggers
        setVisualRollRequest({ rollString, label, key: rollKey + 1 });
    }, [rollKey]); // Depend on rollKey

    const value = useMemo(() => ({
        visualRollRequest,
        triggerVisualRoll,
    }), [visualRollRequest, triggerVisualRoll]);

    return (
        <DiceRollContext.Provider value={value}>
            {children}
        </DiceRollContext.Provider>
    );
};

export const useDiceRoller = (): DiceRollContextType => {
    const context = useContext(DiceRollContext);
    if (context === undefined) {
        throw new Error('useDiceRoller must be used within a DiceRollProvider');
    }
    return context;
};
