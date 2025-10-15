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

    // Helper function to check if a file should be filtered out
    const shouldFilterFile = (file: File): boolean => {
        // @ts-ignore - webkitRelativePath exists on File in browsers that support directory upload
        const filePath = file.webkitRelativePath || file.name;

        // Exclude common build/dependency directories
        const excludedPaths = [
            '.git/',
            'node_modules/',
            '__pycache__/',
            '.venv/',
            'venv/',
            'env/',
            'dist/',
            'build/',
            '.next/',
            '.nuxt/',
            'target/', // Rust/Java builds
            'bin/',
            'obj/',
            '.vs/',
            '.vscode/',
            '.idea/',
            'coverage/',
            '.nyc_output/',
            'logs/',
            'tmp/',
            'temp/',
        ];

        // Check if file path contains any excluded directories
        if (excludedPaths.some(exclude => filePath.includes(exclude))) {
            return true;
        }

        // Only allow source code files
        const allowedExtensions = [
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.vue', '.svelte',
            '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
            '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
            '.md', '.txt', '.rst', '.adoc', '.tex', '.r', '.m', '.scala', '.clj',
            '.fs', '.fsx', '.ml', '.mli', '.hs', '.elm', '.dart', '.lua', '.pl',
            '.groovy', '.gradle', '.maven', '.dockerfile', '.makefile'
        ];

        const fileName = filePath.toLowerCase();
        const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

        // Special cases for files without extensions but are important
        const specialFiles = ['dockerfile', 'makefile', 'rakefile', 'gemfile', 'procfile'];
        const isSpecialFile = specialFiles.some(special => fileName.endsWith(special));

        return !(hasAllowedExtension || isSpecialFile);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;

        if (files && files.length > 0) {
            // Filter out unwanted files on the frontend
            const validFiles = Array.from(files).filter(file => !shouldFilterFile(file));

            // Create a new FileList-like object with filtered files
            const dataTransfer = new DataTransfer();
            validFiles.forEach(file => dataTransfer.items.add(file));

            setSelectedFiles(dataTransfer.files);

            // Auto-generate repository name from the first folder
            const firstFile = validFiles[0];
            if (firstFile) {
                // @ts-ignore - webkitRelativePath exists on File in browsers that support directory upload
                const relativePath = firstFile.webkitRelativePath || firstFile.name;
                const folderName = relativePath.split('/')[0];
                if (folderName && !repositoryName) {
                    setRepositoryName(folderName);
                }
            }
        } else {
            setSelectedFiles(files);
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
            const filesArray = Array.from(selectedFiles);
            const CHUNK_SIZE = 500; // Upload files in chunks of 500

            // If we have too many files, upload in chunks
            if (filesArray.length > CHUNK_SIZE) {
                setError(`Too many files selected (${filesArray.length}). Please select a smaller folder or contact support for large repository uploads.`);
                setIsLoading(false);
                return;
            }

            const formData = new FormData();

            // Add files to form data with their relative paths
            filesArray.forEach((file, index) => {
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
                        Upload a Python project from your local machine for analysis
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-950/30 border border-blue-800 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-blue-400">Currently supports Python (.py) files only</span>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Folder Upload</CardTitle>
                        <CardDescription>
                            Select a folder containing your Python source code. Helix will analyze the uploaded files, preserve folder structure, and provide insights including dependency diagrams and code metrics.
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
                                {fileCount > 500 && (
                                    <p className="text-sm text-red-400 mt-1">
                                        ⚠️ Too many files ({fileCount}). Limit is 500 files per upload. Consider uploading a smaller folder.
                                    </p>
                                )}
                                {fileCount > 100 && fileCount <= 500 && (
                                    <p className="text-sm text-orange-400 mt-1">
                                        Note: Large uploads ({fileCount} files) may take some time to process
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
                            <p>Source code files: Python, JavaScript, TypeScript, Java, C++, C#, PHP, Ruby, Go, Rust, Swift, Kotlin, and many more</p>
                            <p>Config files: JSON, YAML, XML, Dockerfile, Makefile</p>
                            <p>Documentation: Markdown, text files</p>

                            <p className="mt-4"><strong>Automatically filtered out:</strong></p>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                                <li><strong>Dependencies:</strong> node_modules, __pycache__, .venv, venv, env</li>
                                <li><strong>Build outputs:</strong> dist, build, target, bin, obj, .next, .nuxt</li>
                                <li><strong>Version control:</strong> .git directories</li>
                                <li><strong>IDEs:</strong> .vs, .vscode, .idea</li>
                                <li><strong>Temporary:</strong> logs, tmp, temp, coverage, .nyc_output</li>
                            </ul>

                            <p className="mt-4"><strong>Privacy & Security:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Files are processed locally on your machine - no external data sharing</li>
                                <li>Intelligent filtering reduces upload time and improves analysis quality</li>
                                <li>Only source code and configuration files are analyzed</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LocalAnalysisPage;