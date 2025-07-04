// src/pages/DependencyGraphPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from 'reactflow';
import dagre from 'dagre';

// Import reactflow styles
import 'reactflow/dist/style.css';
const InternalNode = ({ data }: { data: { label: string } }) => (
  <div style={{ padding: '10px', border: '1px solid #666', borderRadius: '5px', background: '#222' }}>
    {data.label}
  </div>
);

const ExternalNode = ({ data }: { data: { label:string } }) => (
  <div style={{ padding: '10px', border: '1px dashed #f59e0b', borderRadius: '5px', background: '#3a3024', color: '#f59e0b' }}>
    {data.label}
  </div>
);
// Dagre layouting setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';
    // We are shifting the dagre node position (anchor=center) to the top left
    // so it matches react-flow's anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};


export const DependencyGraphPage = () => {
  const { repoId } = useParams<{ repoId: string }>();
  
  // --- 1. CALL ALL HOOKS UNCONDITIONALLY AT THE TOP ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const layouted = getLayoutedElements(nodes, edges, direction);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // This hook must also be at the top level
  const nodeTypes = useMemo(() => ({
    internalNode: InternalNode,
    externalNode: ExternalNode,
  }), []);
  // --- END HOOKS SECTION ---

  useEffect(() => {
    const fetchGraphData = async () => {
      if (!repoId) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/dependency-graph/`);
        const { nodes: initialNodes, edges: initialEdges } = response.data;
        
        if (initialNodes.length === 0) {
            setNodes([]);
            setEdges([]);
            // No need to return here, let the render logic handle the empty state
        } else {
            const layouted = getLayoutedElements(initialNodes, initialEdges);
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
        }

      } catch (err) {
        setError("Failed to load dependency graph. Please ensure the repository has been processed.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, [repoId, setNodes, setEdges]); // Add setNodes/setEdges to dependency array as per linter best practices

  // --- 2. HANDLE CONDITIONAL RENDERING AFTER ALL HOOKS ---
  if (isLoading) {
    return <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground">Loading architecture graph...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full p-8 text-center text-destructive">{error}</div>;
  }
  
  if (nodes.length === 0) {
    return <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground">No internal module dependencies were found to build a graph.</div>;
  }
  // --- END CONDITIONAL RENDERING ---

  return (
    <div className="h-full w-full">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={() => onLayout('TB')} className="px-2 py-1 text-xs bg-card border rounded hover:bg-muted">Vertical Layout</button>
          <button onClick={() => onLayout('LR')} className="px-2 py-1 text-xs bg-card border rounded hover:bg-muted">Horizontal Layout</button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} // Pass the custom node types
        fitView
        className="bg-background"
      >
        <Controls />
        <MiniMap nodeColor={(n) => n.type === 'externalNode' ? '#F59E0B' : '#4A5568'} />
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
};