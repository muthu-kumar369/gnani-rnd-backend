import { ITool, ToolParameter } from '../tool.interface.js';

export class TimeTool implements ITool {
    name = 'get_current_time';
    description = 'Get the current time, optionally for a specific timezone.';
    parameters: ToolParameter[] = [
        {
            name: 'timezone',
            type: 'string',
            description: 'The timezone to get the time for (e.g., "America/New_York", "UTC"). Defaults to local server time.',
            required: false
        }
    ];

    async execute(params: any): Promise<any> {
        const timezone = params.timezone;
        const options: Intl.DateTimeFormatOptions = {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
            timeZoneName: 'short'
        };

        if (timezone) {
            try {
                options.timeZone = timezone;
            } catch (e) {
                return { error: `Invalid timezone: ${timezone}` };
            }
        }

        const timeString = new Date().toLocaleTimeString('en-US', options);
        const dateString = new Date().toLocaleDateString('en-US', { ...options, timeZone: timezone || undefined });
        const fullDateTime = new Date().toLocaleString('en-US', { ...options, timeZone: timezone || undefined });
        
        return {
            time: timeString,
            date: dateString,
            fullDateTime: fullDateTime,
            timezone: timezone || 'Local',
            timestamp: Date.now()
        };
    }
}
