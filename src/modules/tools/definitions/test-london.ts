import { OpenMeteoClient } from './open-meteo.client.js';

async function testLondon() {
    const client = new OpenMeteoClient();
    console.log('--- Testing London, UK ---');
    try {
        const coords = await client.getCoordinates('London, UK');
        console.log('Result:', coords);
    } catch (error) {
        console.error('Error:', error);
    }
}

testLondon();
