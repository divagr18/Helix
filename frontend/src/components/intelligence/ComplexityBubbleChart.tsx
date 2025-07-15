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

export const ComplexityBubbleChart: React.FC<ComplexityBubbleChartProps> = ({ symbols, onBubbleHover, highlightedSymbolId }) => {
    const [nodes, setNodes] = useState<BubbleNode[]>([]);
    const containerSize = { width: 600, height: 400 }; // Example size

    const complexityDomain = useMemo(() => {
        const complexities = symbols.map(s => s.cyclomatic_complexity || 1);
        return [Math.min(...complexities), Math.max(...complexities)];
    }, [symbols]);

    const radiusScale = useMemo(() =>
        scaleSqrt()
            .domain(complexityDomain)
            .range([15, 60]), // Min and max bubble radius
        [complexityDomain]
    );

    useEffect(() => {
        const initialNodes: BubbleNode[] = symbols.map(symbol => ({
            id: symbol.id,
            name: symbol.name,
            complexity: symbol.cyclomatic_complexity || 1,
            radius: radiusScale(symbol.cyclomatic_complexity || 1),
        }));

        const simulation = d3.forceSimulation(initialNodes)
            .force('charge', d3.forceManyBody().strength(5))
            .force('center', d3.forceCenter(containerSize.width / 2, containerSize.height / 2))
            .force('collision', d3.forceCollide().radius(d => (d as BubbleNode).radius + 2))
            .on('tick', () => {
                setNodes([...initialNodes]);
            });

        return () => simulation.stop();
    }, [symbols, radiusScale, containerSize]);

    const getColor = (complexity: number) => {
        if (complexity >= 5) return 'bg-red-500/70'; // High
        if (complexity >= 3) return 'bg-orange-500/70'; // Medium
        return 'bg-green-500/70'; // Low
    };

    return (
        <div className="relative" style={{ width: containerSize.width, height: containerSize.height }}>
            {nodes.map(node => (
                <motion.div
                    key={node.id}
                    onMouseEnter={() => onBubbleHover(node.id)}
                    onMouseLeave={() => onBubbleHover(null)}
                    animate={{ x: node.x, y: node.y }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={cn(
                        "absolute rounded-full flex items-center justify-center cursor-pointer transition-all duration-200",
                        getColor(node.complexity),
                        highlightedSymbolId === node.id ? 'ring-2 ring-offset-2 ring-offset-card ring-primary' : ''
                    )}
                    style={{
                        width: node.radius * 2,
                        height: node.radius * 2,
                    }}
                >
                    {/* Optionally show name on larger bubbles */}
                </motion.div>
            ))}
        </div>
    );
};