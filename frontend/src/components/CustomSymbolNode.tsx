// frontend/src/components/CustomSymbolNode.tsx
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { FaCodeBranch, FaBullseye, FaUserFriends, FaProjectDiagram } from 'react-icons/fa'; // Example icons

// Assuming SymbolNodeData is defined in types.ts or passed appropriately
interface SymbolNodeData {
    label: string;
    type: 'central' | 'caller' | 'callee';
    db_id: number;
}

const CustomSymbolNode: React.FC<NodeProps<SymbolNodeData>> = ({ data }) => {
    const nodeStyles: React.CSSProperties = {
        padding: '10px 15px',
        borderRadius: '8px',
        border: '1px solid #555',
        fontSize: '12px',
        textAlign: 'center',
        minWidth: '150px',
        // backgroundColor: data.type === 'central' ? '#87CEEB' : (data.type === 'caller' ? '#90EE90' : '#FFB6C1'),
        // color: '#111',
    };
    
    // More GitHub-like styling
    let backgroundColor = '#2d333b'; // Default node
    let borderColor = '#444c56';
    let textColor = '#c9d1d9';
    let icon = <FaCodeBranch />;

    if (data.type === 'central') {
        backgroundColor = '#1f6feb'; // Blue for central
        borderColor = '#58a6ff';
        textColor = '#ffffff';
        icon = <FaBullseye />;
    } else if (data.type === 'caller') {
        backgroundColor = '#238636'; // Green for caller
        borderColor = '#30a14e';
        textColor = '#ffffff';
        icon = <FaUserFriends transform="scale(-1, 1)" />; // Flipped icon
    } else if (data.type === 'callee') {
        backgroundColor = '#8B1A1A'; // Darker Red for callee
        borderColor = '#DA3633';
        textColor = '#ffffff';
        icon = <FaProjectDiagram />;
    }


    return (
        <div style={{ ...nodeStyles, backgroundColor, borderColor, color: textColor }}>
            <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px' }}>
                <span style={{ marginRight: '8px', fontSize: '1.1em' }}>{icon}</span>
                <strong>{data.label}</strong>
            </div>
            <div style={{fontSize: '0.8em', color: textColor === '#ffffff' ? '#adbac7' : '#555'}}>
                ID: {data.db_id} ({data.type})
            </div>
            <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
        </div>
    );
};

export default memo(CustomSymbolNode); // memo for performance