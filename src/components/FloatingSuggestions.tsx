import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface FloatingSuggestionsProps {
    onSelect: (query: string) => void;
}

const suggestions = [
    "Plan date night from saved",
    "What in UWS fits my taste?",
    "Add place from this reel",
    "Find dinner spot in SoHo",
    "Saved spots near me?",
    "Add Insta link to my list",
    "Suggest brunch I'd love",
    "Pick from 'Must Try' list",
    "Good match in Chelsea?",
    "Add TikTok place to map",
    "Find coffee fitting my vibe",
    "Show top rated saved spots"
];

export const FloatingSuggestions = ({ onSelect }: FloatingSuggestionsProps) => {
    // Select 4 random suggestions on mount
    const randomSuggestions = useMemo(() => {
        const shuffled = [...suggestions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 4);
    }, []);

    return (
        <div className="w-full h-full flex items-end justify-center pb-8 px-4">
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {randomSuggestions.map((text, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(text)}
                        className={cn(
                            "bg-white border border-orange-200 text-orange-600",
                            "px-2 py-1 font-medium text-xs text-center leading-tight", // Reduced padding and font
                            "rounded-lg transition-all hover:-translate-y-0.5",
                            "shadow-[0_2px_8px_rgba(255,127,80,0.15)] hover:shadow-[0_4px_12px_rgba(255,127,80,0.25)]", // Orange accented shadow
                            "w-full h-12 flex items-center justify-center", // Fixed height reduced to h-12
                            "pointer-events-auto" // Fix clickability
                        )}
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
};
