// src/components/symbol-detail/DependencyListItem.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react'; // Replaced FaCodeBranch

import { type LinkedSymbol } from '@/pages/SymbolDetailPage'; // Assuming type is in parent or src/types.ts

interface DependencyListItemProps {
    dependency: LinkedSymbol;
}

export const DependencyListItem: React.FC<DependencyListItemProps> = ({ dependency }) => {
    return (
        <li className="mb-1.5">
            <Link
                to={`/symbol/${dependency.id}`}
                title={dependency.unique_id || dependency.name} // Fallback to name if unique_id is missing
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
            >
                <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate text-foreground">{dependency.name}</span>
                {/* Optionally display unique_id if it's short enough or in a tooltip */}
                {/* <span className="ml-auto text-xs text-muted-foreground truncate hidden md:inline-block">{dependency.unique_id}</span> */}
            </Link>
        </li>
    );
};