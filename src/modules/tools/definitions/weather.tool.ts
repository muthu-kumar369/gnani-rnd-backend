import { ITool, ToolParameter } from '../tool.interface.js';
import axios from 'axios';
import { createContextualLogger } from '../../../core/logger/logger.js';

export class WeatherTool implements ITool {
    name = 'get_weather';
    description = 'Get the current weather for a specific location.';
    parameters: ToolParameter[] = [
        {
            name: 'location',
            type: 'string',
            description: 'The city and state/country to get the weather for (e.g., "London, UK", "New York, NY").',
            required: true
        }
    ];

    private logger = createContextualLogger({ module: 'WeatherTool' });
    private apiKey = process.env.OPENWEATHER_API_KEY;

    async execute(params: any): Promise<any> {
        const location = params.location;
        if (!location) {
            return { error: 'Location is required' };
        }

        if (!this.apiKey) {
            this.logger.warn('OPENWEATHER_API_KEY is not set. Returning mock data.');
            // Return mock data if no API key
            return {
                location: location,
                temperature: 22,
                unit: 'Celsius',
                condition: 'Partly Cloudy',
                humidity: 60,
                wind_speed: 15,
                note: 'Mock data (API key missing)'
            };
        }

        try {
            // Geocoding first (optional, but better for accuracy) or direct weather call
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric`;
            const response = await axios.get(url);
            const data = response.data;

            return {
                location: `${data.name}, ${data.sys.country}`,
                temperature: data.main.temp,
                unit: 'Celsius',
                condition: data.weather[0].description,
                humidity: data.main.humidity,
                wind_speed: data.wind.speed
            };
        } catch (error: any) {
            this.logger.error(`Error fetching weather: ${error.message}`);
            return { error: `Failed to fetch weather: ${error.message}` };
        }
    }
}
