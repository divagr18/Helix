// src/components/intelligence/ComplexityBubbleChart.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { type CodeSymbol } from '@/types';
import * as d3 from 'd3-force';
import { scaleSqrt } from 'd3-scale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BubbleNode extends d3.SimulationNodeDatum {
    id: number;
    name: string;
    complexity: number;
    radius: number;
}

interface ComplexityBubbleChartProps {
    symbols: CodeSymbol[];
    onBubbleHover: (symbolId: number | null) => void;
    highlightedSymbolId: number | null;
}

export const ComplexityBubbleChart: React.FC<ComplexityBubbleChartProps> = ({
    symbols,
    onBubbleHover,
    highlightedSymbolId,
}) => {
    const [nodes, setNodes] = useState<BubbleNode[]>([]);
    const containerSize = { width: 600, height: 400 };

    const complexityDomain = useMemo(() => {
        const complexities = symbols.map((s) => s.cyclomatic_complexity || 1);
        return [Math.min(...complexities), Math.max(...complexities)];
    }, [symbols]);

    const radiusScale = useMemo(
        () =>
            scaleSqrt()
                .domain(complexityDomain)
                .range([15, 60]),
        [complexityDomain]
    );

    useEffect(() => {
        const initialNodes: BubbleNode[] = symbols.map((symbol) => ({
            id: symbol.id,
            name: symbol.name,
            complexity: symbol.cyclomatic_complexity || 1,
            radius: radiusScale(symbol.cyclomatic_complexity || 1),
        }));

        const simulation = d3
            .forceSimulation(initialNodes)
            .force('charge', d3.forceManyBody().strength(2)) // Reduced from 5 to 2
            // reduced centering pulls
            .force('x', d3.forceX(containerSize.width / 2).strength(0.05))
            .force('y', d3.forceY(containerSize.height / 2).strength(0.05))
            .force('collision', d3.forceCollide().radius((d) => (d as BubbleNode).radius + 2))
            .on('tick', () => {
                // copy positions out so React sees the change
                setNodes(initialNodes.map((d) => ({ ...d })));
            });

        return () => simulation.stop();
    }, [symbols, radiusScale]);

    const getColor = (complexity: number) => {
        if (complexity >= 5) return 'bg-red-500/70';
        if (complexity >= 3) return 'bg-orange-500/70';
        return 'bg-green-500/70';
    };

    return (
        <div
            className="relative overflow-visible"
            style={{ width: containerSize.width, height: containerSize.height }}
        >
            {nodes.map((node) => (
                <motion.div
                    key={node.id}
                    onMouseEnter={() => onBubbleHover(node.id)}
                    onMouseLeave={() => onBubbleHover(null)}
                    animate={{
                        x: (node.x || 0) - node.radius,
                        y: (node.y || 0) - node.radius,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 50 }}
                    className="absolute cursor-pointer group overflow-visible"
                    style={{
                        width: node.radius * 2,
                        height: node.radius * 2,
                        overflow: 'visible',
                    }}
                >
                    {/* Bubble circle */}
                    <div
                        className={cn(
                            "w-full h-full rounded-full transition-all",
                            getColor(node.complexity),
                            highlightedSymbolId === node.id
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110'
                                : 'group-hover:scale-105'
                        )}
                    />

                    {/* Label always visible, using color instead of opacity */}
                    <div
                        className={cn(
                            "absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[150px] text-center overflow-visible transition-all duration-200",
                            highlightedSymbolId === node.id ? "scale-110" : ""
                        )}
                    >
                        <span
                            className={cn(
                                "text-xs font-mono px-2 py-1 rounded-md select-none",
                                highlightedSymbolId === node.id
                                    ? 'bg-primary text-primary-foreground font-semibold'
                                    : 'bg-muted/50 text-muted-foreground/70'
                            )}
                        >
                            {node.name}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};