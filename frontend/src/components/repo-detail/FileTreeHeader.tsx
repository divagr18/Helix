// src/components/repo-detail/FileTreeHeader.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react'; // For breadcrumb-like separator

interface FileTreeHeaderProps {
  repoFullName: string;
}

export const FileTreeHeader: React.FC<FileTreeHeaderProps> = ({ repoFullName }) => {
  const repoName = repoFullName.split('/')[1] || repoFullName;

  return (
    <div className="p-3 md:p-4 border-b border-border">
      <h2 className="text-base md:text-lg font-semibold text-foreground flex items-center">
        <Link to="/dashboard" className="text-primary hover:underline">
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
        <span className="truncate" title={repoName}>{repoName}</span>
      </h2>
    </div>
  );
};