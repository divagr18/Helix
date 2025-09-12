import { useState, useEffect } from 'react';

export const useElectron = () => {
    const [isElectron, setIsElectron] = useState(false);
    const [electronAPI, setElectronAPI] = useState<typeof window.electronAPI | null>(null);

    useEffect(() => {
        // Check if we're running in Electron
        const isElectronApp = !!(window as any).electronAPI;
        setIsElectron(isElectronApp);

        if (isElectronApp) {
            setElectronAPI((window as any).electronAPI);
        }
    }, []);

    return {
        isElectron,
        electronAPI,
        // Helper methods
        openFolderDialog: electronAPI?.onFolderSelected,
        showDialog: electronAPI?.showMessageBox,
        getAppVersion: electronAPI?.getVersion,
        platform: electronAPI?.platform
    };
};
