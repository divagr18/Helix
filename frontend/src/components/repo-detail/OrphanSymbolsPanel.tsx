// src/components/repo-detail/OrphanSymbolsPanel.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'; // Replaced FaAngle icons and OrphanIndicator

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area'; // For the list if it's long
import { Badge } from '@/components/ui/badge'; // Optional: for the count

// Assuming CodeSymbol type is in src/types.ts and includes filePath & className for orphans
import { type CodeSymbol } from '@/types';

export interface OrphanSymbolDisplayItem extends CodeSymbol {
  // These fields are added by the parent when preparing the list
  filePath: string;
  className?: string;
}

interface OrphanSymbolsPanelProps {
  orphanSymbols: OrphanSymbolDisplayItem[];
}

export const OrphanSymbolsPanel: React.FC<OrphanSymbolsPanelProps> = ({
  orphanSymbols,
}) => {
  const [isOpen, setIsOpen] = useState(false); // Manage collapsible state internally

  if (!orphanSymbols || orphanSymbols.length === 0) {
    return null; // Don't render anything if there are no orphans
  }

  return (
    // The parent div in RepoDetailPage already provides p-3/p-4, border-t, bg-background, shadow-inner
    // This component just renders its content within that.
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center">
              {isOpen ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
              Potential Orphan Symbols
            </div>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {orphanSymbols.length}
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Max height and scroll area for the list */}
          <ScrollArea className="max-h-40 md:max-h-48 mt-1.5 rounded-md border border-border bg-muted/30">
            <ul className="p-2 space-y-1.5 text-xs">
              {orphanSymbols.map(orphan => (
                <li key={`orphan-${orphan.id}`} className="p-1 hover:bg-accent/50 rounded-sm">
                  <Link
                    to={`/symbol/${orphan.id}`}
                    title={`View details for ${orphan.name} in ${orphan.filePath}`}
                    className="text-primary hover:underline truncate block font-medium"
                  >
                    {orphan.name}
                  </Link>
                  <div className="text-muted-foreground truncate text-[0.7rem] leading-tight">
                    <span>{orphan.filePath}</span>
                    {orphan.className && <span className="ml-1">({orphan.className})</span>}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};