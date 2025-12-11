import logger from '../../core/logger/logger.js';

class TrieNode {
    children: Map<string, TrieNode> = new Map();
    isEnd: boolean = false;
    count: number = 0;
}

class Trie {
    private root = new TrieNode();

    insert(word: string): void {
        let node = this.root;
        for (const char of word.toLowerCase()) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char)!;
            node.count++;
        }
        node.isEnd = true;
    }

    search(prefix: string, limit: number): string[] {
        let node = this.root;
        for (const char of prefix.toLowerCase()) {
            if (!node.children.has(char)) return [];
            node = node.children.get(char)!;
        }

        // DFS to find all words
        const results: Array<{ word: string; count: number }> = [];
        this.dfs(node, prefix, results);

        // Sort by frequency
        results.sort((a, b) => b.count - a.count);

        return results.slice(0, limit).map(r => r.word);
    }

    private dfs(node: TrieNode, prefix: string, results: any[]): void {
        if (node.isEnd) {
            results.push({ word: prefix, count: node.count });
        }

        for (const [char, child] of node.children) {
            this.dfs(child, prefix + char, results);
        }
    }
}

/**
 * Search Suggestions Service
 * Stage 5 Task 5.9: Autocomplete and suggestions
 */
export class SearchSuggestionsService {
    private trie: Trie = new Trie();
    private userTries: Map<string, Trie> = new Map();

    async buildIndex(userId: string, queries: string[]): Promise<void> {
        logger.info('Building search index', {
            context: 'SearchSuggestionsService',
            userId,
            queryCount: queries.length
        });

        const userTrie = new Trie();
        queries.forEach(q => userTrie.insert(q));

        this.userTries.set(userId, userTrie);

        logger.info('Search index built', {
            context: 'SearchSuggestionsService',
            userId
        });
    }

    getSuggestions(prefix: string, userId: string, limit: number = 5): string[] {
        const userTrie = this.userTries.get(userId);

        if (!userTrie) {
            logger.debug('No suggestions available for user', {
                context: 'SearchSuggestionsService',
                userId
            });
            return [];
        }

        const suggestions = userTrie.search(prefix, limit);

        logger.debug('Suggestions generated', {
            context: 'SearchSuggestionsService',
            prefix,
            count: suggestions.length
        });

        return suggestions;
    }

    async recordQuery(userId: string, query: string): Promise<void> {
        // Get or create user trie
        if (!this.userTries.has(userId)) {
            this.userTries.set(userId, new Trie());
        }

        const userTrie = this.userTries.get(userId)!;
        userTrie.insert(query);

        // TODO: Persist to database
        logger.debug('Query recorded', {
            context: 'SearchSuggestionsService',
            userId,
            query
        });
    }

    clearUserIndex(userId: string): void {
        this.userTries.delete(userId);
        logger.info('User search index cleared', {
            context: 'SearchSuggestionsService',
            userId
        });
    }
}

export const searchSuggestionsService = new SearchSuggestionsService();
