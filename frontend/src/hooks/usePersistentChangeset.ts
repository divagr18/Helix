// src/hooks/usePersistentChangeset.ts
import { useState, useEffect, useCallback } from 'react';

// Define the return type of the hook for better type safety and autocompletion
type ChangesetManager = [
  Map<string, string>, // stagedChanges
  (filePath: string, newContent: string) => void, // stageChange
  (filePath: string) => void, // unstageChange
  () => void // clearChanges
];

export function usePersistentChangeset(repoId: number | null): ChangesetManager {
  // Use a unique key for each repository to store its changeset
  const storageKey = repoId ? `helix-changeset-${repoId}` : '';

  // Initialize state by reading from localStorage
  const getInitialState = useCallback((): Map<string, string> => {
    if (!storageKey) return new Map();
    try {
      const item = window.localStorage.getItem(storageKey);
      // The stored value is an array of [key, value] pairs
      return item ? new Map(JSON.parse(item)) : new Map();
    } catch (error) {
      console.error("Error reading changeset from localStorage", error);
      return new Map();
    }
  }, [storageKey]);

  const [stagedChanges, setStagedChanges] = useState<Map<string, string>>(getInitialState);

  // When the repoId changes, re-initialize the state from localStorage
  useEffect(() => {
    setStagedChanges(getInitialState());
  }, [repoId, getInitialState]);

  // When the stagedChanges map updates, write the new state to localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      // Convert the Map to an array of [key, value] pairs for JSON serialization
      const serializedChanges = JSON.stringify(Array.from(stagedChanges.entries()));
      window.localStorage.setItem(storageKey, serializedChanges);
    } catch (error)
    {
      console.error("Error writing changeset to localStorage", error);
    }
  }, [stagedChanges, storageKey]);

  const stageChange = useCallback((filePath: string, newContent: string) => {
    setStagedChanges(prev => new Map(prev).set(filePath, newContent));
  }, []);

  const unstageChange = useCallback((filePath: string) => {
    setStagedChanges(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
  }, []);

  const clearChanges = useCallback(() => {
    setStagedChanges(new Map());
  }, []);

  return [stagedChanges, stageChange, unstageChange, clearChanges];
}