// src/components/ui/FileUploadDropzone.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'sonner';
import { UploadCloud, Loader2, FileText, X } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

interface FileUploadDropzoneProps {
    repoId: number;
    onUploadSuccess: () => void;
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({ repoId, onUploadSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [commitHash, setCommitHash] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
        multiple: false,
    });

    const handleUpload = async () => {
        if (!file || !commitHash) {
            toast.error("Please select a file and enter a commit hash.");
            return;
        }
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('commit_hash', commitHash);

        try {
            await axios.post(`/api/v1/repositories/${repoId}/coverage/upload/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success("Upload successful!", { description: "Your report is being processed and will appear shortly." });
            onUploadSuccess();
            setFile(null);
            setCommitHash('');
        } catch (error) {
            toast.error("Upload failed.", { description: "Please check the console for details." });
            console.error("Upload error:", error);
        } finally {
            setIsUploading(false);
        }
    };

    if (file) {
        return (
            <div className="p-6 mt-4 bg-card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="mt-4 space-y-3">
                    <Input
                        placeholder="Enter commit hash (e.g., a1b2c3d)"
                        value={commitHash}
                        onChange={(e) => setCommitHash(e.target.value)}
                        disabled={isUploading}
                    />
                    <Button onClick={handleUpload} disabled={isUploading || !commitHash} className="w-full">
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                        {isUploading ? 'Uploading...' : 'Upload and Process'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div {...getRootProps()} className={`mt-4 p-8 border-dashed border-2 cursor-pointer border-[#1d1d1d] transition-colors ${isDragActive ? 'border-[#1d1d1d]' : 'hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <div className="text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 font-regular">Drag & drop your coverage.xml here</p>
                <p className="text-sm text-muted-foreground">or click to select a file</p>
            </div>
        </div>
    );
};