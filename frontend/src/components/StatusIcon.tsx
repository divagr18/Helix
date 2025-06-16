import { FaCheckCircle, FaExclamationCircle, FaQuestionCircle } from 'react-icons/fa';

interface StatusIconProps {
    contentHash: string | null;
    docHash: string | null;
    hasDoc: boolean;
}

export function StatusIcon({ contentHash, docHash, hasDoc }: StatusIconProps) {
    let status: 'fresh' | 'stale' | 'undocumented' = 'undocumented';

    if (hasDoc) {
        // If contentHash is null, we can't verify, so treat as stale for safety.
        if (contentHash && docHash && contentHash === docHash) {
            status = 'fresh';
        } else {
            status = 'stale';
        }
    }

    if (status === 'fresh') {
        return <FaCheckCircle color="limegreen" title="Documentation is fresh" style={{ flexShrink: 0, marginLeft: '10px' }} />;
    }
    if (status === 'stale') {
        return <FaExclamationCircle color="#e54545" title="Documentation is stale" style={{ flexShrink: 0, marginLeft: '10px' }} />;
    }
    return <FaQuestionCircle color="#f0b429" title="Undocumented" style={{ flexShrink: 0, marginLeft: '10px' }} />;
}