import { WeatherTool } from './weather.tool.js';

async function testWeather() {
    const tool = new WeatherTool();

    console.log('--- Testing WeatherTool with Open-Meteo ---');

    const locations = [
        'London',
        'New York',
        'InvalidCityName12345'
    ];

    for (const loc of locations) {
        console.log(`\nFetching weather for: ${loc}`);
        try {
            const result = await tool.execute({ location: loc });
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

testWeather();
