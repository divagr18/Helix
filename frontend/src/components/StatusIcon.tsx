import React from 'react';
import {
  FaCheckCircle, // Fresh
  FaExclamationCircle, // Stale
  FaTimesCircle, // No Documentation
  FaHourglassHalf, // Pending Review (or other intermediate states)
  FaQuestionCircle, // Unknown or other
  FaEdit // Human Edited - Pending PR (if you use this status)
} from 'react-icons/fa';

interface StatusIconProps {
  documentationStatus?: string | null;
  contentHash?: string | null;
  docHash?: string | null;
  hasDoc?: boolean;
}

const DOC_STATUS = {
  NONE: 'NONE',
  PENDING_REVIEW: 'PENDING_REVIEW',
  EDITED_PENDING_PR: 'EDITED_PENDING_PR', // Or your 'APPROVED' status
  STALE: 'STALE',
  FRESH: 'FRESH',
};

export const StatusIcon: React.FC<StatusIconProps> = ({
  documentationStatus,
  // hasDoc, // We can derive this from documentationStatus mostly
  // contentHash, 
  // docHash 
}) => {
  let title = "Documentation status unknown";
  let color = "grey";
  let IconComponent = FaQuestionCircle;

  switch (documentationStatus) {
    case DOC_STATUS.NONE:
      title = "No documentation";
      color = "#6c757d"; // Bootstrap secondary gray
      IconComponent = FaTimesCircle;
      break;
    case DOC_STATUS.FRESH:
      title = "Documentation is fresh and up-to-date";
      color = "#28a745"; // Bootstrap success green
      IconComponent = FaCheckCircle;
      break;
    case DOC_STATUS.STALE:
      title = "Documentation is stale (code has changed)";
      color = "#ffc107"; // Bootstrap warning yellow/orange
      IconComponent = FaExclamationCircle;
      break;
    case DOC_STATUS.PENDING_REVIEW:
      title = "AI Generated - Pending Review";
      color = "#007bff"; // Bootstrap primary blue
      IconComponent = FaHourglassHalf;
      break;
    case DOC_STATUS.EDITED_PENDING_PR: // Or your 'APPROVED' status
      title = "Documentation approved/edited, ready for PR";
      color = "#17a2b8"; // Bootstrap info cyan
      IconComponent = FaEdit; // Or FaCheckCircle if it implies freshness for PR
      break;
    default:
      // Fallback if documentationStatus is null or an unexpected value,
      // but documentation might exist (e.g. old data before status field)
      // This part might need refinement based on how you handle symbols without a status yet
      title = "Documentation status unclear or needs processing";
      color = "#ffc107"; // Treat as potentially stale or needing attention
      IconComponent = FaExclamationCircle;
      break;
  }

  return (
    <span title={title} style={{ color, fontSize: '1.1em', verticalAlign: 'middle' }}>
      <IconComponent />
    </span>
  );
};