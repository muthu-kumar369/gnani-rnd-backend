import { ITool, ToolParameter } from '../tool.interface.js';
import axios from 'axios';
import { createContextualLogger } from '../../../core/logger/logger.js';

export class SearchTool implements ITool {
    name = 'web_search';
    description = 'Search the web for information about current events, facts, or general knowledge.';
    parameters: ToolParameter[] = [
        {
            name: 'query',
            type: 'string',
            description: 'The search query.',
            required: true
        }
    ];

    private logger = createContextualLogger({ module: 'SearchTool' });
    private apiKey = process.env.TAVILY_API_KEY; // Using Tavily as it's great for LLMs

    async execute(params: any): Promise<any> {
        const query = params.query;
        if (!query) {
            return { error: 'Query is required' };
        }

        if (!this.apiKey) {
            this.logger.warn('TAVILY_API_KEY is not set. Returning mock data.');
            return {
                query: query,
                results: [
                    { title: 'Mock Result 1', content: `This is a mock search result for "${query}".` },
                    { title: 'Mock Result 2', content: 'Please configure TAVILY_API_KEY to get real results.' }
                ],
                note: 'Mock data (API key missing)'
            };
        }

        try {
            const response = await axios.post('https://api.tavily.com/search', {
                api_key: this.apiKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 3
            });

            return {
                query: query,
                answer: response.data.answer,
                results: response.data.results.map((r: any) => ({
                    title: r.title,
                    content: r.content,
                    url: r.url
                }))
            };
        } catch (error: any) {
            this.logger.error(`Error searching web: ${error.message}`);
            return { error: `Failed to search: ${error.message}` };
        }
    }
}
