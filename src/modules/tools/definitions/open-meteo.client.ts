import axios from 'axios';

export interface GeoLocation {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
}

export interface WeatherData {
    temperature: number;
    unit: string;
    condition: string;
    humidity: number;
    wind_speed: number;
}

export class OpenMeteoClient {
    private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
    private readonly weatherUrl = 'https://api.open-meteo.com/v1/forecast';

    async getCoordinates(city: string): Promise<GeoLocation | null> {
        try {
            // Check if input has a comma (e.g. "London, UK" or "Paris, Texas")
            let searchTerm = city;
            let context = '';

            if (city.includes(',')) {
                const parts = city.split(',');
                searchTerm = parts[0].trim();
                context = parts.slice(1).join(' ').trim().toLowerCase();
            }

            const response = await axios.get(this.geocodingUrl, {
                params: {
                    name: searchTerm,
                    count: 10, // Fetch more results to filter
                    language: 'en',
                    format: 'json'
                }
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                const results = response.data.results;

                if (context) {
                    // Try to find a match with the context (country or admin1)
                    const match = results.find((r: any) => {
                        const country = (r.country || '').toLowerCase();
                        const countryCode = (r.country_code || '').toLowerCase();
                        const admin1 = (r.admin1 || '').toLowerCase();

                        return country.includes(context) ||
                            countryCode === context ||
                            admin1.includes(context);
                    });

                    if (match) {
                        return {
                            name: match.name,
                            latitude: match.latitude,
                            longitude: match.longitude,
                            country: match.country,
                            admin1: match.admin1
                        };
                    }
                }

                // Default to first result if no context or no match found
                const result = results[0];
                return {
                    name: result.name,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    country: result.country,
                    admin1: result.admin1
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching coordinates:', error);
            throw new Error('Failed to fetch coordinates');
        }
    }

    async getWeather(lat: number, lon: number): Promise<WeatherData> {
        try {
            const response = await axios.get(this.weatherUrl, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                    wind_speed_unit: 'kmh'
                }
            });

            const current = response.data.current;

            return {
                temperature: current.temperature_2m,
                unit: response.data.current_units.temperature_2m, // Usually '°C'
                condition: this.getWeatherDescription(current.weather_code),
                humidity: current.relative_humidity_2m,
                wind_speed: current.wind_speed_10m
            };
        } catch (error) {
            console.error('Error fetching weather:', error);
            throw new Error('Failed to fetch weather data');
        }
    }

    private getWeatherDescription(code: number): string {
        const weatherCodes: { [key: number]: string } = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            56: 'Light freezing drizzle',
            57: 'Dense freezing drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            66: 'Light freezing rain',
            67: 'Heavy freezing rain',
            71: 'Slight snow fall',
            73: 'Moderate snow fall',
            75: 'Heavy snow fall',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail'
        };

        return weatherCodes[code] || 'Unknown';
    }
}
