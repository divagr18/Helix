// src/components/intelligence/OrphansDashboard.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { DataTable } from '@/components/ui/data-table';
import { columns, type OrphanData } from './orphan-columns';

export const OrphansDashboard = () => {
  const { activeRepository } = useWorkspaceStore();
  const [orphans, setOrphans] = useState<OrphanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeRepository) {
      setIsLoading(true);
      axios.get(`/api/v1/repositories/${activeRepository.id}/intelligence/orphan-symbols/`)
        .then(response => setOrphans(response.data))
        .finally(() => setIsLoading(false));
    }
  }, [activeRepository]);

  if (!activeRepository) return <p>Please select a repository.</p>;
  if (isLoading) return <p>Scanning for orphan symbols...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Orphan Symbols</h2>
        <p className="text-muted-foreground">
          These symbols are defined but appear to be uncalled within the repository.
        </p>
      </div>
      
      {/* --- THIS IS THE NEW CONTAINER --- */}
      {/* We wrap the DataTable in a div that provides the background and border */}
      <div className="bg-card p-4 rounded-lg border border-border/60">
        <DataTable 
          columns={columns} 
          data={orphans}
          filterColumnId="file_path"
          filterPlaceholder="Filter by file path..."
        />
      </div>
    </div>
  );
};