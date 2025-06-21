import React from 'react';
import { FaGhost } from 'react-icons/fa';

interface OrphanIndicatorProps {
    isOrphan?: boolean;
}

export const OrphanIndicator: React.FC<OrphanIndicatorProps> = ({ isOrphan }) => {
    if (!isOrphan) {
        return null; // Don't render anything if not an orphan
    }

    return (
        <span
            title="Potential orphan symbol (not called within the repository)"
            style={{
                marginLeft: '8px', // Space from other icons/text
                color: '#ff7043', // A distinct warning/orange color
                fontSize: '0.9em', // Slightly smaller than main status icon
                verticalAlign: 'middle',
                display: 'inline-flex',
                alignItems: 'center'
            }}
        >
            <FaGhost />
            <span style={{ marginLeft: '4px', fontStyle: 'italic', fontSize: '0.9em' }}>(Orphan)</span>
        </span>
    );
};