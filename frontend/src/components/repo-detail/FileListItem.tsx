// src/components/repo-detail/FileListItem.tsx
import React from 'react';
import { Link } from 'react-router-dom'; // If file name links to a file detail page later
import { FileCode, Bot, GitPullRequest, Loader2 } from 'lucide-react'; // Replaced FaFileCode, FaMagic, FaGithub, FaSync

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type CodeFile } from '@/types'; // Assuming types are in src/types.ts

interface FileListItemProps {
  file: CodeFile;
  isSelectedForBatch: boolean;
  onBatchSelectionChange: (fileId: number, isSelected: boolean) => void;
  isSelectedFile: boolean; // Is this the currently viewed file in the center panel?
  onFileSelect: (file: CodeFile) => void; // To select the file for viewing
  
  onGenerateDocsForFile: (fileId: number, fileName: string) => void;
  isProcessingDocsThisFile: boolean; // True if "Docs" button for THIS file is active
  
  onCreatePRForFile: (fileId: number, fileName: string) => void;
  isCreatingPRThisFile: boolean; // True if "PR" button for THIS file is active
  
  isAnyGlobalBatchProcessing: boolean; // True if any global batch (doc gen or PR) is running
                                      // OR if any other file's individual action is running.
  
  batchMessageForThisFile: string | null;
  prMessageForThisFile: string | null;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  isSelectedForBatch,
  onBatchSelectionChange,
  isSelectedFile,
  onFileSelect,
  onGenerateDocsForFile,
  isProcessingDocsThisFile,
  onCreatePRForFile,
  isCreatingPRThisFile,
  isAnyGlobalBatchProcessing, // Use this to disable buttons if another file is being processed
  batchMessageForThisFile,
  prMessageForThisFile,
}) => {
  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    onBatchSelectionChange(file.id, checked === true);
  };

  const fileSpecificOperationInProgress = isProcessingDocsThisFile || isCreatingPRThisFile;

  return (
    <li
      className={`mb-1 rounded-md transition-colors group ${
        isSelectedFile ? 'bg-primary/10 text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <div className="flex items-center p-2 md:p-2.5"> {/* Slightly less padding for list items */}
        <Checkbox
          id={`file-checkbox-${file.id}`}
          checked={isSelectedForBatch}
          onCheckedChange={handleCheckboxChange}
          className="mr-2 md:mr-3 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          disabled={isAnyGlobalBatchProcessing && !fileSpecificOperationInProgress} // Disable if a global batch is running unless it's this file
          aria-label={`Select file ${file.file_path} for batch processing`}
        />
        
        <div
          onClick={() => onFileSelect(file)}
          className={`flex-grow flex items-center gap-2 min-w-0 p-1 rounded-sm cursor-pointer 
                      ${isSelectedFile ? 'font-semibold' : ''}`}
          title={file.file_path}
        >
          <FileCode className={`h-4 w-4 flex-shrink-0 ${isSelectedFile ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground'}`} />
          <span className="truncate text-sm">
            {file.file_path}
          </span>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center ml-2 gap-1 md:gap-1.5 flex-shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm" // Custom smaller icon button size
                  onClick={(e) => { e.stopPropagation(); onGenerateDocsForFile(file.id, file.file_path); }}
                  disabled={isProcessingDocsThisFile || (isAnyGlobalBatchProcessing && !isCreatingPRThisFile)} // Disable if this is processing, or any global op is running (unless it's this file's PR creation)
                  className="h-7 w-7 data-[state=disabled]:opacity-50"
                >
                  {isProcessingDocsThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isProcessingDocsThisFile ? "Processing Docs..." : `Generate Docs for ${file.file_path}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.stopPropagation(); onCreatePRForFile(file.id, file.file_path); }}
                  disabled={isCreatingPRThisFile || (isAnyGlobalBatchProcessing && !isProcessingDocsThisFile)}
                  className="h-7 w-7 data-[state=disabled]:opacity-50"
                >
                  {isCreatingPRThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitPullRequest className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isCreatingPRThisFile ? "Creating PR..." : `Create PR for ${file.file_path}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Display batch/PR message for this file */}
      {(batchMessageForThisFile || prMessageForThisFile) && (
        <div className={`px-2.5 pb-2 pt-1 text-xs border-t border-dashed 
                        ${(batchMessageForThisFile?.toLowerCase().includes('error') || batchMessageForThisFile?.toLowerCase().includes('failed') ||
                          prMessageForThisFile?.toLowerCase().includes('error') || prMessageForThisFile?.toLowerCase().includes('failed'))
                          ? 'text-destructive border-destructive/30' 
                          : 'text-muted-foreground border-border/50'}`}
        >
          {batchMessageForThisFile || prMessageForThisFile}
        </div>
      )}
    </li>
  );
};