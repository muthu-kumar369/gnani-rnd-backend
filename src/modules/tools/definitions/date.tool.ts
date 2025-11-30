import { ITool, ToolParameter } from '../tool.interface.js';

export class DateTool implements ITool {
    name = 'get_current_date';
    description = 'Get the current date.';
    parameters: ToolParameter[] = [];

    async execute(params: any): Promise<any> {
        const date = new Date();
        return {
            date: date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            iso: date.toISOString()
        };
    }
}
