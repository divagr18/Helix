// Global type definitions for Electron API
declare global {
    interface Window {
        electronAPI: {
            // App info
            getVersion: () => Promise<string>;

            // File system operations
            onFolderSelected: (callback: (event: any, folderPath: string) => void) => void;

            // Dialog operations
            showMessageBox: (options: {
                type?: 'none' | 'info' | 'error' | 'question' | 'warning';
                buttons?: string[];
                defaultId?: number;
                title?: string;
                message: string;
                detail?: string;
            }) => Promise<{ response: number; checkboxChecked?: boolean }>;

            // Platform info
            platform: string;

            // Remove listeners
            removeAllListeners: (channel: string) => void;
        };
    }
}

export { };
