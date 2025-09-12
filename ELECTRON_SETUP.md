# Helix CME Desktop Application

## Fully Integrated Docker Setup

### Prerequisites
- Docker and Docker Compose installed
- X11 forwarding enabled (Linux) or VNC viewer (Windows/Mac)

### Quick Start

**Option 1: Full Docker Integration (Recommended)**
```bash
# Start all services including Electron in Docker
npm run start-all

# Or directly with docker-compose
docker-compose up -d
```

**Option 2: Hybrid Approach (Docker backend + Local Electron)**
```bash
# Windows - starts Docker services then local Electron
npm run desktop
```

### Access Methods

**Method 1: VNC Access (Recommended for Windows/Mac)**
1. Start the services: `npm run start-all`
2. Connect to VNC: `localhost:5900`
3. Use any VNC viewer (TigerVNC, RealVNC, etc.)

**Method 2: X11 Forwarding (Linux)**
1. Enable X11 forwarding: `xhost +local:docker`
2. Start services: `npm run start-all`
3. Electron will display on your desktop

**Method 3: Local Electron + Docker Backend**
1. Use the hybrid script: `npm run desktop`
2. Electron runs natively, connects to Docker services

### Development Commands

```bash
# Start all Docker services (including Electron)
npm run start-all

# View Electron logs
npm run logs-electron

# View all service logs
npm run logs

# Stop all services
npm run stop
```

### Features Added

#### Desktop Integration
- **Native File Dialogs**: Better folder selection using OS native dialogs
- **Application Menu**: File, Edit, View, Window menus with keyboard shortcuts
- **Desktop App Experience**: Runs as a native desktop application

#### Keyboard Shortcuts
- `Ctrl+O` / `Cmd+O`: Open folder dialog
- `Ctrl+Q` / `Cmd+Q`: Quit application
- `F12`: Toggle DevTools (development)
- `Ctrl+R` / `Cmd+R`: Reload
- `F11`: Toggle fullscreen

#### Security Features
- Context isolation enabled
- Node integration disabled in renderer
- Secure preload script for IPC communication

### File Structure
```
electron/
├── main.js          # Main Electron process
├── preload.js       # Secure IPC bridge
├── package.json     # Electron dependencies and build config
└── assets/          # App icons and resources

frontend/
├── src/
│   ├── hooks/
│   │   └── useElectron.ts    # Hook for Electron detection and API
│   └── types/
│       └── electron.d.ts     # TypeScript definitions
```

### Benefits of Desktop Version

1. **Better Performance**: Native app performance vs browser limitations
2. **File System Access**: Direct access to local files and folders
3. **Offline Capabilities**: Can work offline for code analysis
4. **Professional UX**: Feels like a traditional IDE/development tool
5. **OS Integration**: Native notifications, file associations, etc.

### Development Tips

- The app automatically detects if it's running in Electron vs browser
- Use `useElectron()` hook to access Electron-specific features
- Frontend code works in both browser and Electron environments
- DevTools are available in development mode

### Future Enhancements

- Auto-updater for seamless updates
- Native file watching for real-time code changes
- Deeper OS integration (file associations, context menus)
- Offline mode with local analysis capabilities
- Plugin system for custom analyzers
