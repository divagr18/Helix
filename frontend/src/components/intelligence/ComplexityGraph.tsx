// src/components/intelligence/ComplexityGraph.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3-force';
import { scaleSqrt } from 'd3-scale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type CodeSymbol, type GraphLinkData, type GraphNode, type GraphLink } from '@/types';

interface ComplexityGraphProps {
    nodesData: CodeSymbol[];
    linksData: GraphLinkData[];
    onNodeHover: (symbolId: number | null) => void;
    highlightedNodeId: number | null;
    width: number;
    height: number;
}

export const ComplexityGraph: React.FC<ComplexityGraphProps> = ({
    nodesData,
    linksData,
    onNodeHover,
    highlightedNodeId,
    width,
    height,
}) => {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [links, setLinks] = useState<GraphLink[]>([]);

    // --- Scaling and Coloring Logic ---
    const complexityDomain = useMemo(() => {
        if (nodesData.length === 0) return [1, 1];
        const complexities = nodesData.map(s => s.cyclomatic_complexity || 1);
        return [Math.min(...complexities), Math.max(...complexities)];
    }, [nodesData]);

    const radiusScale = useMemo(() =>
        scaleSqrt().domain(complexityDomain).range([8, 40]), // Smaller min, larger max for better visual range
        [complexityDomain]
    );

    const getColorClass = (complexity: number): string => {
        if (complexity >= 5) return 'fill-[hsl(var(--complexity-high))]';
        if (complexity >= 3) return 'fill-[hsl(var(--complexity-medium))]';
        return 'fill-[hsl(var(--complexity-low))]';
    };

    // --- D3 Simulation Effect ---
    useEffect(() => {
        if (!nodesData || nodesData.length === 0) return;

        const initialNodes: GraphNode[] = nodesData.map(d => ({
            id: d.id,
            name: d.name,
            complexity: d.cyclomatic_complexity || 1,
            radius: radiusScale(d.cyclomatic_complexity || 1),
            x: width / 2, // Start nodes in the center
            y: height / 2,
        }));

        const simulation = d3.forceSimulation(initialNodes)
            .force('link', d3.forceLink<GraphNode, GraphLinkData>(linksData).id(d => d.id).strength(0.1).distance(90))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide<GraphNode>().radius(d => d.radius + 4).strength(0.8))
            .on('tick', () => {
                setNodes([...initialNodes]);
                // D3 mutates the linksData array to replace number IDs with node objects
                setLinks([...linksData] as GraphLink[]);
            });

        return () => simulation.stop();
    }, [nodesData, linksData, radiusScale, width, height]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Define an arrowhead marker */}
            <defs>
                <marker
                    id="arrowhead"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/50" />
                </marker>
            </defs>

            {/* Render Links */}
            <g className="links">
                {links.map((link, i) => {
                    const sourceNode = link.source as GraphNode;
                    const targetNode = link.target as GraphNode;
                    if (!sourceNode.x || !targetNode.x) return null; // D3 might not have placed them yet

                    return (
                        <motion.line
                            key={i}
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            className="stroke-muted-foreground/40"
                            strokeWidth="1.5"
                            markerEnd="url(#arrowhead)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />
                    );
                })}
            </g>

            {/* Render Nodes */}
            <g className="nodes">
                {nodes.map(node => (
                    <motion.g
                        key={node.id}
                        transform={`translate(${node.x || 0}, ${node.y || 0})`}
                        onMouseEnter={() => onNodeHover(node.id)}
                        onMouseLeave={() => onNodeHover(null)}
                        className="cursor-pointer group"
                    >
                        <circle
                            r={node.radius}
                            className={cn(
                                getColorClass(node.complexity),
                                "transition-all duration-200 ease-in-out",
                                "group-hover:stroke-primary group-hover:stroke-2",
                                highlightedNodeId === node.id ? "stroke-primary stroke-2" : "stroke-card stroke-1"
                            )}
                        />
                        {/* Show label on hover or if it's a large node */}
                        {(node.radius > 20 || highlightedNodeId === node.id) && (
                            <text
                                textAnchor="middle"
                                y={node.radius + 14}
                                className="text-xs fill-foreground pointer-events-none select-none"
                            >
                                {node.name}
                            </text>
                        )}
                    </motion.g>
                ))}
            </g>
        </svg>
    );
};