import { OpenMeteoClient } from './open-meteo.client.js';

async function testGeocoding() {
    const client = new OpenMeteoClient();

    const queries = [
        'Paris',
        'Paris, Texas',
        'Paris, France',
        'London',
        'London, Ontario',
        'Hyderabad',
        'Hyderabad, Pakistan',
        'Hyderabad Pakistan'
    ];

    console.log('--- Testing Geocoding Robustness ---');

    for (const q of queries) {
        try {
            const coords = await client.getCoordinates(q);
            if (coords) {
                console.log(`Query: "${q}" -> Found: ${coords.name}, ${coords.admin1 || ''}, ${coords.country} (${coords.latitude}, ${coords.longitude})`);
            } else {
                console.log(`Query: "${q}" -> Not Found`);
            }
        } catch (error) {
            console.error(`Query: "${q}" -> Error:`, error);
        }
    }
}

testGeocoding();
