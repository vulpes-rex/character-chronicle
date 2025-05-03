import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface StatBoxProps {
    label: string;
    score: number;
    modifier: number;
    // savingThrow?: number; // Optional: Display saving throw if needed
}

export function StatBox({ label, score, modifier /*, savingThrow*/ }: StatBoxProps) {
    const modString = modifier >= 0 ? `+${modifier}` : `${modifier}`;

    return (
        <div className="flex flex-col items-center p-3 border rounded-lg text-center bg-card shadow-sm">
            <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1">{label}</Label>
            <span className="text-3xl font-bold">{score}</span>
            <span className="text-lg font-medium text-primary border border-primary rounded-full px-2 py-0.5 mt-1">
                {modString}
            </span>
            {/* Optional Saving Throw Display
            {savingThrow !== undefined && (
                <span className="text-xs text-muted-foreground mt-1">
                    Save: {savingThrow >= 0 ? `+${savingThrow}` : savingThrow}
                </span>
            )}
            */}
        </div>
    );
}
