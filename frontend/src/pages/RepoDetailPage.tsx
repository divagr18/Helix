// src/pages/RepoDetailPage.tsx
import React from 'react';
import { ContentAnalysisPanel } from '@/components/layout/ContentAnalysisPanel';

// This component is now just a layout placeholder.
// The real layout is defined in App.tsx and AppLayout.tsx
export const RepoDetailPage = () => {
  // All the logic and state has been moved to RepoContext.
  // This component's only job is to render the central panel's content.
  return <ContentAnalysisPanel />;
};