export class TtsService {
    async getAvailableVoices(): Promise<any[]> {
        // Return curated list of personas mapped to standard Web Speech API voice characteristics
        // The frontend will match these to available system voices
        return [
            {
                id: 'jarvis',
                name: 'Jarvis',
                gender: 'male',
                description: 'Deep, Professional, British-style',
                category: 'premium',
                tags: ['assistant', 'professional', 'authoritative']
            },
            {
                id: 'friday',
                name: 'Friday',
                gender: 'female',
                description: 'Clear, Efficient, Professional',
                category: 'premium',
                tags: ['assistant', 'efficient', 'clear']
            },
            {
                id: 'edith',
                name: 'EDITH',
                gender: 'neutral',
                description: 'Robotic, Precise, Minimal',
                category: 'standard',
                tags: ['robotic', 'technical']
            },
            {
                id: 'atlas',
                name: 'Atlas',
                gender: 'male',
                description: 'Deep, Commanding, Resonant',
                category: 'standard',
                tags: ['commanding', 'narrator']
            },
            {
                id: 'luna',
                name: 'Luna',
                gender: 'female',
                description: 'Soft, Calm, Ethereal',
                category: 'standard',
                tags: ['soft', 'calm', 'meditative']
            },
            {
                id: 'orion',
                name: 'Orion',
                gender: 'male',
                description: 'Energetic, Fast, Crisp',
                category: 'standard',
                tags: ['energetic', 'news', 'fast']
            },
            {
                id: 'nova',
                name: 'Nova',
                gender: 'female',
                description: 'Bright, Cheerful, Upbeat',
                category: 'standard',
                tags: ['cheerful', 'friendly']
            },
            {
                id: 'echo',
                name: 'Echo',
                gender: 'neutral',
                description: 'Reverberant, Spacious',
                category: 'experimental',
                tags: ['effect', 'space']
            }
        ];
    }
}

export default new TtsService();
