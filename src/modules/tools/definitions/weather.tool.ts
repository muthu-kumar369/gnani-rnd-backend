import { ITool, ToolParameter } from '../tool.interface.js';
import { createContextualLogger } from '../../../core/logger/logger.js';
import { OpenMeteoClient } from './open-meteo.client.js';

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
    private client = new OpenMeteoClient();

    async execute(params: any): Promise<any> {
        const location = params.location;
        if (!location) {
            return { error: 'Location is required' };
        }

        try {
            this.logger.info(`Fetching weather for location: ${location}`);

            // 1. Geocoding
            const coords = await this.client.getCoordinates(location);

            if (!coords) {
                this.logger.warn(`Location not found: ${location}`);
                return { error: `Location '${location}' not found.` };
            }

            // 2. Weather Data
            const weather = await this.client.getWeather(coords.latitude, coords.longitude);

            // 3. Construct Response (matching previous format)
            const locationName = coords.admin1
                ? `${coords.name}, ${coords.admin1}, ${coords.country}`
                : `${coords.name}, ${coords.country}`;

            return {
                location: locationName,
                temperature: weather.temperature,
                unit: 'Celsius', // Open-Meteo defaults to Celsius, and we requested it implicitly (or can be explicit)
                condition: weather.condition,
                humidity: weather.humidity,
                wind_speed: weather.wind_speed,
                // Adding extra info that might be useful but keeping core structure
                coordinates: {
                    lat: coords.latitude,
                    lon: coords.longitude
                }
            };

        } catch (error: any) {
            this.logger.error(`Error fetching weather: ${error.message}`);
            return { error: `Failed to fetch weather: ${error.message}` };
        }
    }
}
