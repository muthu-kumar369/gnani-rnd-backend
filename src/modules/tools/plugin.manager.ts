// src/modules/tools/plugin.manager.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import { IPlugin, PluginConfig, PluginRegistryEntry } from './plugin.interface.js';
import { watch, FSWatcher } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';

class PluginManager {
    private logger: Logger;
    private plugins: Map<string, PluginRegistryEntry>;
    private pluginDirectory: string;
    private watcher?: FSWatcher;
    private hotReloadEnabled: boolean;

    constructor() {
        this.logger = createContextualLogger({ module: 'PluginManager' });
        this.plugins = new Map();
        this.pluginDirectory = process.env.PLUGIN_DIRECTORY || './plugins';
        this.hotReloadEnabled = process.env.HOT_RELOAD_ENABLED === 'true';
        this.logger.info(`PluginManager initialized. Directory: ${this.pluginDirectory}`);
    }

    /**
     * Load a plugin from file
     */
    async loadPlugin(pluginPath: string, config?: PluginConfig): Promise<boolean> {
        try {
            this.logger.info(`Loading plugin from: ${pluginPath}`);

            // Dynamic import
            const module = await import(pluginPath);
            const plugin: IPlugin = module.default || module;

            // Validate plugin
            if (!this.validatePlugin(plugin)) {
                throw new Error('Invalid plugin structure');
            }

            // Check dependencies
            if (plugin.metadata.dependencies) {
                for (const dep of plugin.metadata.dependencies) {
                    if (!this.plugins.has(dep)) {
                        throw new Error(`Missing dependency: ${dep}`);
                    }
                }
            }

            // Call onLoad hook
            if (plugin.onLoad) {
                await plugin.onLoad();
            }

            // Register plugin
            const entry: PluginRegistryEntry = {
                plugin,
                config: config || {
                    enabled: true,
                    autoLoad: true,
                    hotReload: this.hotReloadEnabled
                },
                loadedAt: new Date(),
                status: 'loaded'
            };

            this.plugins.set(plugin.metadata.name, entry);
            this.logger.info(`Plugin loaded: ${plugin.metadata.name} v${plugin.metadata.version}`);

            return true;
        } catch (error: any) {
            this.logger.error(`Failed to load plugin: ${error.message}`);
            return false;
        }
    }

    /**
     * Unload a plugin
     */
    async unloadPlugin(pluginName: string): Promise<boolean> {
        try {
            const entry = this.plugins.get(pluginName);
            if (!entry) {
                throw new Error(`Plugin not found: ${pluginName}`);
            }

            // Call onUnload hook
            if (entry.plugin.onUnload) {
                await entry.plugin.onUnload();
            }

            // Update status
            entry.status = 'unloaded';
            this.plugins.delete(pluginName);

            this.logger.info(`Plugin unloaded: ${pluginName}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to unload plugin: ${error.message}`);
            return false;
        }
    }

    /**
     * Reload a plugin (hot-reload)
     */
    async reloadPlugin(pluginName: string): Promise<boolean> {
        try {
            const entry = this.plugins.get(pluginName);
            if (!entry) {
                throw new Error(`Plugin not found: ${pluginName}`);
            }

            if (!entry.config.hotReload) {
                throw new Error(`Hot-reload not enabled for plugin: ${pluginName}`);
            }

            this.logger.info(`Reloading plugin: ${pluginName}`);

            // Call onReload hook
            if (entry.plugin.onReload) {
                await entry.plugin.onReload();
            }

            // Update timestamp
            entry.lastReloadAt = new Date();

            this.logger.info(`Plugin reloaded: ${pluginName}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to reload plugin: ${error.message}`);
            return false;
        }
    }

    /**
     * Load all plugins from directory
     */
    async loadAllPlugins(): Promise<void> {
        try {
            const files = await readdir(this.pluginDirectory);
            const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));

            for (const file of pluginFiles) {
                const pluginPath = path.join(this.pluginDirectory, file);
                await this.loadPlugin(pluginPath);
            }

            this.logger.info(`Loaded ${this.plugins.size} plugins from directory`);
        } catch (error: any) {
            this.logger.error(`Failed to load plugins from directory: ${error.message}`);
        }
    }

    /**
     * Start watching plugin directory for changes
     */
    startWatching(): void {
        if (!this.hotReloadEnabled) {
            this.logger.info('Hot-reload disabled, not starting watcher');
            return;
        }

        this.watcher = watch(this.pluginDirectory, async (eventType, filename) => {
            if (!filename) return;

            this.logger.info(`Plugin directory change detected: ${eventType} ${filename}`);

            // Find plugin by filename
            for (const [name, entry] of this.plugins.entries()) {
                if (entry.config.hotReload) {
                    await this.reloadPlugin(name);
                }
            }
        });

        this.logger.info('Plugin directory watcher started');
    }

    /**
     * Stop watching plugin directory
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.logger.info('Plugin directory watcher stopped');
        }
    }

    /**
     * Get all loaded plugins
     */
    getLoadedPlugins(): IPlugin[] {
        return Array.from(this.plugins.values())
            .filter(entry => entry.status === 'loaded')
            .map(entry => entry.plugin);
    }

    /**
     * Get plugin by name
     */
    getPlugin(name: string): IPlugin | undefined {
        const entry = this.plugins.get(name);
        return entry?.status === 'loaded' ? entry.plugin : undefined;
    }

    /**
     * Validate plugin structure
     */
    private validatePlugin(plugin: any): plugin is IPlugin {
        return (
            plugin &&
            plugin.metadata &&
            plugin.metadata.name &&
            plugin.metadata.version &&
            Array.isArray(plugin.tools) &&
            typeof plugin.executeTool === 'function'
        );
    }

    /**
     * Get statistics for monitoring
     */
    getStats(): any {
        const plugins = Array.from(this.plugins.values());

        return {
            totalPlugins: plugins.length,
            loadedPlugins: plugins.filter(p => p.status === 'loaded').length,
            errorPlugins: plugins.filter(p => p.status === 'error').length,
            hotReloadEnabled: this.hotReloadEnabled,
            pluginDirectory: this.pluginDirectory,
            plugins: plugins.map(p => ({
                name: p.plugin.metadata.name,
                version: p.plugin.metadata.version,
                status: p.status,
                toolCount: p.plugin.tools.length,
                loadedAt: p.loadedAt,
                lastReloadAt: p.lastReloadAt
            }))
        };
    }
}

export default new PluginManager();
