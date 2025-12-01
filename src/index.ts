import './app.js';
import toolRegistry from './modules/tools/tool.registry.js';

// Initialize tools
toolRegistry.loadAllTools().catch((err: any) => {
    console.error('Failed to load tools:', err);
});