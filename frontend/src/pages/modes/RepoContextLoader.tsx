// src/pages/modes/RepoContextLoader.tsx
import React, { useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom'; // <-- Make sure Outlet is imported
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { RepoProvider } from '@/contexts/RepoContext'; // <-- The provider goes here!

export const RepoContextLoader = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const { activeRepository, setActiveRepository } = useWorkspaceStore();

  useEffect(() => {
    const repoIdNum = repoId ? parseInt(repoId, 10) : undefined;
    if (repoIdNum && repoIdNum !== activeRepository?.id) {
      // This logic is correct: fetch repo header info and set it as active
      axios.get(`/api/v1/repositories/${repoIdNum}/`) // Use the full repo detail endpoint for now
        .then(response => {
          setActiveRepository(response.data);
        })
        .catch(() => {
          setActiveRepository(null);
        });
    }
  }, [repoId, activeRepository, setActiveRepository]);

  // The RepoProvider wraps the Outlet, providing context to the specific "Mode" page
  return (
    <RepoProvider>
      <Outlet />
    </RepoProvider>
  );
};