import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Folder, AlertCircle, CheckCircle2, Upload, FileText, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCookie } from '@/utils';
import { useElectron } from '@/hooks/useElectron';

const LocalAnalysisPage: React.FC = () => {
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [repositoryName, setRepositoryName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const navigate = useNavigate();
    const { isElectron, electronAPI } = useElectron();

    useEffect(() => {
        if (isElectron && electronAPI) {
            // Listen for folder selection from native dialog
            electronAPI.onFolderSelected((event, folderPath) => {
                setSelectedFolderPath(folderPath);
                const folderName = folderPath.split(/[/\\]/).pop() || 'Unknown Folder';
                if (!repositoryName) {
                    setRepositoryName(folderName);
                }
            });

            return () => {
                electronAPI.removeAllListeners('folder-selected');
            };
        }
    }, [isElectron, electronAPI, repositoryName]);

    const handleNativeFolderSelect = () => {
        // The folder selection is handled by the main process menu
        // This could also trigger a custom IPC call if needed
        if (electronAPI) {
            electronAPI.showMessageBox({
                type: 'info',
                message: 'Use File > Open Folder from the menu to select a project folder',
                detail: 'You can also use Ctrl+O (Cmd+O on Mac) to open the folder dialog.'
            });
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        setSelectedFiles(files);

        // Auto-generate repository name from the first folder
        if (files && files.length > 0) {
            const firstFile = files[0];
            // @ts-ignore - webkitRelativePath exists on File in browsers that support directory upload
            const relativePath = firstFile.webkitRelativePath || firstFile.name;
            const folderName = relativePath.split('/')[0];
            if (folderName && !repositoryName) {
                setRepositoryName(folderName);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFiles || selectedFiles.length === 0) {
            setError('Please select a folder to upload');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData();

            // Add files to form data with their relative paths
            Array.from(selectedFiles).forEach((file, index) => {
                formData.append('files', file);
                // Also append the relative path as metadata if available
                // @ts-ignore
                if (file.webkitRelativePath) {
                    // @ts-ignore
                    formData.append(`file_paths[${index}]`, file.webkitRelativePath);
                }
            });

            // Add repository name if provided
            if (repositoryName) {
                formData.append('repository_name', repositoryName);
            }

            const response = await fetch('/api/v1/local-analyze/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken') || '',
                },
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message);
                // Navigate to the repository after a short delay
                setTimeout(() => {
                    navigate(`/repository/${data.repository.id}/code`);
                }, 2000);
            } else {
                setError(data.error || 'Failed to upload and analyze repository');
            }
        } catch (err) {
            setError('Network error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const fileCount = selectedFiles ? selectedFiles.length : 0;
    const totalSize = selectedFiles ? Array.from(selectedFiles).reduce((acc, file) => acc + file.size, 0) : 0;

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <Folder className="mx-auto h-12 w-12 text-primary mb-4" />
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        Upload Local Repository
                    </h1>
                    <p className="text-muted-foreground">
                        Upload a folder from your local machine to analyze your code
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Folder Upload</CardTitle>
                        <CardDescription>
                            Select a folder containing your source code. Helix will analyze the uploaded files and provide insights.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="border-green-800 bg-green-950/50">
                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                                <AlertDescription className="text-green-400">
                                    {success}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="folderUpload">Select Folder *</Label>
                            <div className="space-y-2">
                                {isElectron && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={handleNativeFolderSelect}
                                        >
                                            <FolderOpen className="mr-2 h-4 w-4" />
                                            Open Folder (Native)
                                        </Button>
                                        {selectedFolderPath && (
                                            <p className="text-sm text-green-400">
                                                Selected: {selectedFolderPath}
                                            </p>
                                        )}
                                        <div className="text-center text-muted-foreground">or</div>
                                    </>
                                )}

                                <Input
                                    id="folderUpload"
                                    type="file"
                                    // @ts-ignore - webkitdirectory is supported in modern browsers
                                    webkitdirectory=""
                                    multiple
                                    onChange={handleFileChange}
                                    className="cursor-pointer"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Click to select a folder from your computer (folder upload)
                                </p>

                                <div className="text-center text-muted-foreground">or</div>

                                <Input
                                    id="fileUpload"
                                    type="file"
                                    multiple
                                    accept=".py,.js,.ts,.jsx,.tsx,.java,.cpp,.c,.h,.cs,.php,.rb,.go,.rs,.swift,.kt"
                                    onChange={handleFileChange}
                                    className="cursor-pointer"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Or select multiple individual files
                                </p>
                            </div>
                        </div>

                        {selectedFiles && (
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-foreground">Selected Files</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {fileCount} files selected ({(totalSize / 1024 / 1024).toFixed(2)} MB)
                                </p>
                                {fileCount > 100 && (
                                    <p className="text-sm text-orange-400 mt-1">
                                        Note: Large uploads may take some time to process
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="repositoryName">Repository Name (optional)</Label>
                            <Input
                                id="repositoryName"
                                type="text"
                                placeholder="Leave empty to auto-generate from folder name"
                                value={repositoryName}
                                onChange={(e) => setRepositoryName(e.target.value)}
                            />
                        </div>

                        <Button
                            onClick={handleUpload}
                            disabled={isLoading || !selectedFiles || selectedFiles.length === 0}
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload and Analyze
                                </>
                            )}
                        </Button>

                        <div className="text-sm text-muted-foreground space-y-2">
                            <p><strong>Supported file types:</strong></p>
                            <p>Python (.py), JavaScript (.js), TypeScript (.ts), Java (.java), C++ (.cpp), and more</p>

                            <p className="mt-4"><strong>Note:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Files are uploaded securely to the Helix docker backend on your machine for analysis. No data is ever shared outside your machine.</li>
                                <li>Common build directories (.git, node_modules, __pycache__) are automatically filtered out</li>
                                <li>Only source code files are processed</li>
                                <li>Upload size is limited by your browser and server configuration</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LocalAnalysisPage;