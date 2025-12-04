import { Tool, ITool } from './tool.schema.js';

export class ToolService {
    async findAll(): Promise<ITool[]> {
        return await Tool.find().sort({ name: 1 });
    }

    async findById(id: string): Promise<ITool | null> {
        return await Tool.findById(id);
    }

    async findByName(name: string): Promise<ITool | null> {
        return await Tool.findOne({ name });
    }

    async toggleTool(id: string, isEnabled: boolean): Promise<ITool | null> {
        return await Tool.findByIdAndUpdate(
            id,
            { isEnabled },
            { new: true }
        );
    }

    async updateConfig(id: string, config: Record<string, any>): Promise<ITool | null> {
        return await Tool.findByIdAndUpdate(
            id,
            { config },
            { new: true }
        );
    }

    async seedDefaults(): Promise<void> {
        const count = await Tool.countDocuments();
        if (count > 0) return;

        const defaults = [
            {
                name: 'calculator',
                description: 'Perform mathematical calculations.',
                version: '1.0.0',
                author: 'System',
                icon: 'Calculator',
                isEnabled: true,
                isSystem: true,
                configSchema: {},
                config: {}
            },
            {
                name: 'web_browser',
                description: 'Browse the web to find information.',
                version: '1.0.0',
                author: 'System',
                icon: 'Globe',
                isEnabled: true,
                isSystem: true,
                configSchema: {
                    type: 'object',
                    properties: {
                        searchEngine: {
                            type: 'string',
                            enum: ['google', 'bing'],
                            default: 'google',
                            description: 'Search engine to use'
                        }
                    }
                },
                config: {
                    searchEngine: 'google'
                }
            },
            {
                name: 'file_system',
                description: 'Read and write files in the workspace.',
                version: '1.0.0',
                author: 'System',
                icon: 'FolderOpen',
                isEnabled: true,
                isSystem: true,
                configSchema: {
                    type: 'object',
                    properties: {
                        allowedPaths: {
                            type: 'array',
                            items: { type: 'string' },
                            default: ['.'],
                            description: 'Allowed directory paths'
                        }
                    }
                },
                config: {
                    allowedPaths: ['.']
                }
            },
            {
                name: 'code_interpreter',
                description: 'Execute Python code safely.',
                version: '0.9.0',
                author: 'System',
                icon: 'Terminal',
                isEnabled: false, // Disabled by default until sandbox is ready
                isSystem: true,
                configSchema: {
                    type: 'object',
                    properties: {
                        timeout: {
                            type: 'number',
                            default: 30,
                            description: 'Execution timeout in seconds'
                        }
                    }
                },
                config: {
                    timeout: 30
                }
            }
        ];

        await Tool.insertMany(defaults);
        console.log('Seeded default tools');
    }
}

export const toolService = new ToolService();
