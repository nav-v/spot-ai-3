import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface DraggableScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export const DraggableScrollContainer = ({ children, className, ...props }: DraggableScrollContainerProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!ref.current) return;
        setIsDragging(true);
        setStartX(e.pageX - ref.current.offsetLeft);
        setScrollLeft(ref.current.scrollLeft);
        ref.current.style.cursor = 'grabbing';
        ref.current.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
        if (!ref.current) return;
        setIsDragging(false);
        ref.current.style.cursor = 'grab';
        ref.current.style.removeProperty('user-select');
    };

    const handleMouseUp = () => {
        if (!ref.current) return;
        setIsDragging(false);
        ref.current.style.cursor = 'grab';
        ref.current.style.removeProperty('user-select');
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !ref.current) return;
        e.preventDefault();
        const x = e.pageX - ref.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        ref.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <div
            ref={ref}
            className={cn("overflow-x-auto cursor-grab active:cursor-grabbing", className)}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            {...props}
        >
            {children}
        </div>
    );
};
