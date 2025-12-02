// src/modules/tools/plugin.interface.ts
import { ToolDefinition, ToolExecutionResult } from './tool.interface.js';

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
    /**
     * Called when plugin is loaded
     */
    onLoad?(): Promise<void> | void;

    /**
     * Called when plugin is unloaded
     */
    onUnload?(): Promise<void> | void;

    /**
     * Called when plugin is reloaded (hot-reload)
     */
    onReload?(): Promise<void> | void;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
    name: string;
    version: string;
    description: string;
    author?: string;
    dependencies?: string[];
    tags?: string[];
}

/**
 * Plugin interface
 */
export interface IPlugin extends PluginLifecycle {
    /**
     * Plugin metadata
     */
    metadata: PluginMetadata;

    /**
     * Tool definitions provided by this plugin
     */
    tools: ToolDefinition[];

    /**
     * Execute a tool from this plugin
     */
    executeTool(toolName: string, parameters: any, onProgress?: (update: { progress: number; message: string }) => void): Promise<ToolExecutionResult>;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
    enabled: boolean;
    autoLoad: boolean;
    hotReload: boolean;
    config?: Record<string, any>;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
    plugin: IPlugin;
    config: PluginConfig;
    loadedAt: Date;
    lastReloadAt?: Date;
    status: 'loaded' | 'unloaded' | 'error';
    error?: string;
}
