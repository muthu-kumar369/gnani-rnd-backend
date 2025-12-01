import { OpenMeteoClient } from './open-meteo.client.js';

async function testClient() {
    const client = new OpenMeteoClient();

    console.log('--- Testing OpenMeteoClient ---');

    try {
        console.log('Fetching coordinates for London...');
        const coords = await client.getCoordinates('London');
        console.log('Coordinates:', coords);

        if (coords) {
            console.log('Fetching weather for London...');
            const weather = await client.getWeather(coords.latitude, coords.longitude);
            console.log('Weather:', weather);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testClient();
