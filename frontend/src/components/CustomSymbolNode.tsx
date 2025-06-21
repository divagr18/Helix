import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { OrphanIndicator } from './OrphanIndicator';
import { FaRulerCombined, FaBrain } from 'react-icons/fa'; // Import new icons

import {
    FaCogs,
    FaUsersCog,
    FaBullseye,
    FaUserFriends,
    FaProjectDiagram
} from 'react-icons/fa';
import { StatusIcon } from './StatusIcon';

interface CustomNodeData {
    label: string;
    type: 'central' | 'caller' | 'callee';
    db_id: number;
    symbol_kind: 'function' | 'method';
    doc_status: string | null;
    is_orphan?: boolean;
    loc?: number | null;
    cyclomatic_complexity?: number | null;
}

const handleStyle: React.CSSProperties = {
    background: '#586069',
    width: '8px',
    height: '8px',
    borderRadius: '4px',
    border: 'none'
};

const typeStyles = {
    central: {
        backgroundColor: '#162647',
        selectedBg: '#0c4a6e',
        borderColor: '#1f6feb',
        selectedBorder: '#58a6ff',
        icon: FaBullseye
    },
    caller: {
        backgroundColor: '#1a3d20',
        selectedBg: '#104026',
        borderColor: '#238636',
        selectedBorder: '#30a14e',
        icon: FaUserFriends
    },
    callee: {
        backgroundColor: '#4d1f1f',
        selectedBg: '#632021',
        borderColor: '#8B1A1A',
        selectedBorder: '#DA3633',
        icon: FaProjectDiagram
    },
    default: {
        backgroundColor: '#2d333b',
        borderColor: '#444c56',
        selectedBorder: '#58a6ff',
        icon: FaCogs
    }
};

const baseNodeStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    fontSize: '12px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
    textAlign: 'left',
    minWidth: '180px',
    maxWidth: '250px',
    transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out'
};

const textColor = '#c9d1d9';

const CustomSymbolNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
    const styleDef = typeStyles[data.type] ?? typeStyles.default;
    const backgroundColor = selected ? styleDef.selectedBg : styleDef.backgroundColor;
    const borderColor = selected ? styleDef.selectedBorder : styleDef.borderColor;
    const TypeIcon = styleDef.icon;

    const KindIcon = data.symbol_kind === 'method' ? FaUsersCog : FaCogs;

    return (
        <div
            style={{
                ...baseNodeStyle,
                backgroundColor,
                borderColor,
                color: textColor,
                boxShadow: selected ? '0 0 0 2px #58a6ff' : '0 1px 3px rgba(0,0,0,0.1)'
            }}
        >
            <Handle type="target" position={Position.Left} style={handleStyle} />

            {/* Label and icon */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ marginRight: '8px', fontSize: '1.3em', opacity: 0.9, color: textColor }}>
                    <TypeIcon style={data.type === 'caller' ? { transform: 'scaleX(-1)' } : {}} />
                </span>
                <strong style={{ fontSize: '1.05em', wordBreak: 'break-word', color: textColor }}>
                    {data.label}
                </strong>
            </div>

            {/* Kind and status */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.85em',
                    color: '#8b949e',
                    paddingTop: '6px',
                    borderTop: `1px solid ${borderColor === '#444c56' ? '#373e47' : borderColor}`
                }}
            >
                <span style={{ marginRight: '5px', fontSize: '1.1em' }}>
                    <KindIcon />
                </span>
                <span style={{ marginRight: '8px' }}>{data.symbol_kind === 'method' ? 'Method' : 'Function'}</span>
                <StatusIcon documentationStatus={data.doc_status} />
                <OrphanIndicator isOrphan={data.is_orphan} />
            </div>
            {(typeof data.loc === 'number' || typeof data.cyclomatic_complexity === 'number') && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.8em',
                    color: '#8b949e', // Slightly lighter than secondary info
                    paddingTop: '6px',
                    borderTop: `1px dashed ${borderColor === '#444c56' ? '#30363d' : '#444c56'}` // Dashed separator
                }}>
                    {typeof data.loc === 'number' && (
                        <span title={`Lines of Code: ${data.loc}`} style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                            <FaRulerCombined style={{ marginRight: '4px' }} /> {data.loc}
                        </span>
                    )}
                    {typeof data.cyclomatic_complexity === 'number' && (
                        <span title={`Cyclomatic Complexity: ${data.cyclomatic_complexity}`} style={{ display: 'flex', alignItems: 'center' }}>
                            <FaBrain style={{ marginRight: '4px' }} /> {data.cyclomatic_complexity}
                        </span>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Right} style={handleStyle} />
        </div>
    );
};

// ✅ Custom comparison to avoid unnecessary rerenders
export default memo(CustomSymbolNode, (prev, next) => {
    return (
        prev.data.label === next.data.label &&
        prev.data.db_id === next.data.db_id &&
        prev.data.type === next.data.type &&
        prev.data.symbol_kind === next.data.symbol_kind &&
        prev.data.doc_status === next.data.doc_status &&
        prev.selected === next.selected
    );
});
