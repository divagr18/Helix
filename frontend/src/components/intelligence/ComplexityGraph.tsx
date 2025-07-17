// src/components/intelligence/ComplexityGraph.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3-force';
import { scaleSqrt } from 'd3-scale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type CodeSymbol, type GraphLinkData, type GraphNode, type GraphLink } from '@/types';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate(); // <--- 2. Initialize the navigate function
    const { activeRepository } = useWorkspaceStore();

    const complexityDomain = useMemo(() => {
        if (nodesData.length === 0) return [1, 1];
        const complexities = nodesData.map(s => s.cyclomatic_complexity || 1);
        return [Math.min(...complexities), Math.max(...complexities)];
    }, [nodesData]);

    const radiusScale = useMemo(() =>
        scaleSqrt().domain(complexityDomain).range([6, 30]),
        [complexityDomain]
    );

    const getColorClass = (complexity: number): string => {
        if (complexity >= 10) return 'fill-red-500';
        if (complexity >= 5) return 'fill-orange-500';
        return 'fill-green-500';
    };
    const handleNodeClick = (nodeId: number) => {
        if (activeRepository) {
            // Navigate to a new, dedicated refactoring page for this symbol
            const destination = `/repository/${activeRepository.id}/refactor/symbol/${nodeId}`;
            navigate(destination);
        }
    };

    // --- D3 Simulation Effect ---
    useEffect(() => {
        if (!nodesData || nodesData.length === 0 || width === 0 || height === 0) return;

        // Create copies to prevent mutation of props
        const nodesCopy: GraphNode[] = JSON.parse(JSON.stringify(nodesData)).map((d: CodeSymbol) => ({
            id: d.id,
            name: d.name,
            complexity: d.cyclomatic_complexity || 1,
            radius: radiusScale(d.cyclomatic_complexity || 1),
        }));
        const linksCopy: GraphLinkData[] = JSON.parse(JSON.stringify(linksData));

        const simulation = d3.forceSimulation(nodesCopy)
            .force('link', d3.forceLink<GraphNode, GraphLinkData>(linksCopy).id(d => d.id).strength(0.1).distance(60))
            .force('charge', d3.forceManyBody().strength(-80))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide<GraphNode>().radius(d => d.radius + 3).strength(0.8))
            // Expanded boundary force - give nodes more space to move
            .force('bounds', () => {
                nodesCopy.forEach(node => {
                    if (node.x && node.y) {
                        const padding = 5; // Minimal padding
                        const minX = node.radius + padding;
                        const maxX = width - node.radius - padding;
                        const minY = node.radius + padding;
                        const maxY = height - node.radius - padding;

                        // Keep nodes within bounds but with more room to breathe
                        node.x = Math.max(minX, Math.min(maxX, node.x));
                        node.y = Math.max(minY, Math.min(maxY, node.y));
                    }
                });
            })
            .on('tick', () => {
                setNodes([...nodesCopy]);
                setLinks([...linksCopy] as GraphLink[]);
            });

        return () => simulation.stop();
    }, [nodesData, linksData, radiusScale, width, height]);

    return (
        <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full max-h-[600px] border border-border/20"
            style={{ display: 'block' }}
        >
            <defs>
                <marker id="arrowhead" viewBox="-0 -5 10 10" refX="18" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M0,-5L10,0L0,5" className="fill-muted-foreground/50"></path>
                </marker>
            </defs>

            <g className="links">
                {links.map((link, i) => {
                    const sourceNode = link.source as GraphNode;
                    const targetNode = link.target as GraphNode;

                    if (typeof sourceNode.x !== 'number' || typeof targetNode.x !== 'number') {
                        return null;
                    }

                    return (
                        <motion.line
                            key={`${sourceNode.id}-${targetNode.id}-${i}`}
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            className="stroke-muted-foreground/40"
                            strokeWidth="1"
                            markerEnd="url(#arrowhead)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        />
                    );
                })}
            </g>

            <g className="nodes">
                {nodes.map(node => (
                    <motion.g
                        key={node.id}
                        initial={{ x: width / 2, y: height / 2 }}
                        animate={{ x: node.x || 0, y: node.y || 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        onMouseEnter={() => onNodeHover(node.id)}
                        onMouseLeave={() => onNodeHover(null)}
                        onClick={() => handleNodeClick(node.id)}
                        className="cursor-pointer group"
                    >
                        <circle
                            r={node.radius}
                            className={cn(
                                getColorClass(node.complexity),
                                "transition-all duration-200 ease-in-out",
                                "group-hover:stroke-primary group-hover:stroke-[3px]",
                                highlightedNodeId === node.id ? "stroke-primary stroke-[3px]" : "stroke-card/50 stroke-1"
                            )}
                        />
                        {(node.radius > 20 || highlightedNodeId === node.id) && (
                            <text
                                textAnchor="middle"
                                y={node.radius + 14}
                                className="text-[10px] fill-foreground pointer-events-none select-none font-medium"
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