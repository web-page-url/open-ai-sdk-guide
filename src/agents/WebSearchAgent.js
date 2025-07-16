import axios from 'axios';
import * as cheerio from 'cheerio';
import { createChatCompletion } from '../config/openai.js';

export class WebSearchAgent {
  constructor() {
    this.name = 'WebSearchAgent';
    this.description = 'AI agent that can search the internet and get the latest information';
    this.capabilities = ['web_search', 'content_extraction', 'information_synthesis'];
  }

  /**
   * Search the web using multiple providers
   */
  async search(query, maxResults = 5, provider = 'duckduckgo') {
    try {
      console.log(`🔍 Searching for: "${query}"`);
      
      let results = [];
      
      switch (provider.toLowerCase()) {
        case 'duckduckgo':
          results = await this.searchDuckDuckGo(query, maxResults);
          break;
        case 'bing':
          results = await this.searchBing(query, maxResults);
          break;
        case 'google':
          results = await this.searchGoogle(query, maxResults);
          break;
        default:
          results = await this.searchDuckDuckGo(query, maxResults);
      }

      // Extract content from the top results
      const enrichedResults = await this.enrichResults(results);

      // Synthesize information using AI
      const synthesis = await this.synthesizeInformation(query, enrichedResults);

      return {
        success: true,
        query,
        provider,
        results: enrichedResults,
        synthesis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Web search error:', error);
      return {
        success: false,
        error: error.message,
        query,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search using DuckDuckGo (no API key required)
   */
  async searchDuckDuckGo(query, maxResults) {
    try {
      // Use DuckDuckGo instant answer API
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 10000
      });

      const data = response.data;
      const results = [];

      // Add instant answer if available
      if (data.Answer) {
        results.push({
          title: 'Instant Answer',
          snippet: data.Answer,
          url: data.AbstractURL || '#',
          source: 'DuckDuckGo Instant Answer'
        });
      }

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.AbstractSource || 'Abstract',
          snippet: data.Abstract,
          url: data.AbstractURL || '#',
          source: data.AbstractSource || 'DuckDuckGo'
        });
      }

      // Add related topics
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const topics = data.RelatedTopics.slice(0, maxResults - results.length);
        topics.forEach(topic => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              snippet: topic.Text,
              url: topic.FirstURL,
              source: 'DuckDuckGo Related'
            });
          }
        });
      }

      // If no results from API, try scraping (fallback)
      if (results.length === 0) {
        return await this.fallbackSearch(query, maxResults);
      }

      return results.slice(0, maxResults);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return await this.fallbackSearch(query, maxResults);
    }
  }

  /**
   * Search using Bing Search API (requires API key)
   */
  async searchBing(query, maxResults) {
    const apiKey = process.env.BING_SEARCH_API_KEY;
    if (!apiKey) {
      console.warn('Bing API key not found, falling back to DuckDuckGo');
      return await this.searchDuckDuckGo(query, maxResults);
    }

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        },
        params: {
          q: query,
          count: maxResults,
          responseFilter: 'Webpages'
        },
        timeout: 10000
      });

      return response.data.webPages?.value?.map(result => ({
        title: result.name,
        snippet: result.snippet,
        url: result.url,
        source: 'Bing'
      })) || [];
    } catch (error) {
      console.error('Bing search error:', error);
      return await this.searchDuckDuckGo(query, maxResults);
    }
  }

  /**
   * Search using Google Custom Search API (requires API key and Search Engine ID)
   */
  async searchGoogle(query, maxResults) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !engineId) {
      console.warn('Google Search API credentials not found, falling back to DuckDuckGo');
      return await this.searchDuckDuckGo(query, maxResults);
    }

    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: engineId,
          q: query,
          num: maxResults
        },
        timeout: 10000
      });

      return response.data.items?.map(result => ({
        title: result.title,
        snippet: result.snippet,
        url: result.link,
        source: 'Google'
      })) || [];
    } catch (error) {
      console.error('Google search error:', error);
      return await this.searchDuckDuckGo(query, maxResults);
    }
  }

  /**
   * Fallback search method using web scraping
   */
  async fallbackSearch(query, maxResults) {
    try {
      // This is a simple fallback - in production you might want to use other methods
      console.log('Using fallback search method');
      
      return [{
        title: 'Search Results',
        snippet: `I searched for "${query}" but couldn't retrieve specific web results. You may want to search manually or check your internet connection.`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        source: 'Fallback'
      }];
    } catch (error) {
      console.error('Fallback search error:', error);
      return [];
    }
  }

  /**
   * Extract content from URLs to enrich search results
   */
  async enrichResults(results) {
    const enrichedResults = [];

    for (const result of results) {
      try {
        // Skip if URL is not valid for scraping
        if (!result.url || result.url === '#' || result.url.startsWith('javascript:')) {
          enrichedResults.push(result);
          continue;
        }

        // Extract content from the page
        const content = await this.extractPageContent(result.url);
        enrichedResults.push({
          ...result,
          content: content ? content.substring(0, 1000) : result.snippet, // Limit content length
          extractedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Error extracting content from ${result.url}:`, error.message);
        enrichedResults.push(result);
      }
    }

    return enrichedResults;
  }

  /**
   * Extract text content from a web page
   */
  async extractPageContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, header, .ad, .advertisement').remove();
      
      // Extract main content
      const content = $('main, article, .content, .post, .entry, p').text();
      
      return content.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error(`Content extraction error for ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Use AI to synthesize information from search results
   */
  async synthesizeInformation(query, results) {
    try {
      const context = results.map((result, index) => 
        `${index + 1}. ${result.title}\n${result.content || result.snippet}\n`
      ).join('\n');

      const messages = [
        {
          role: 'system',
          content: 'You are a research assistant. Synthesize the search results to provide a comprehensive answer to the user\'s query. Be accurate, cite sources when possible, and provide a clear, well-structured response.'
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nSearch Results:\n${context}\n\nPlease provide a comprehensive answer based on these search results.`
        }
      ];

      const response = await createChatCompletion(messages, {
        max_tokens: 1000,
        temperature: 0.3
      });

      return {
        answer: response.choices[0].message.content,
        sourcesUsed: results.length,
        confidence: 'high'
      };
    } catch (error) {
      console.error('Information synthesis error:', error);
      return {
        answer: 'Unable to synthesize information at this time.',
        sourcesUsed: 0,
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * Search for specific types of information
   */
  async searchSpecific(query, type = 'general', maxResults = 5) {
    const typeModifiers = {
      news: `${query} news latest`,
      academic: `${query} research paper study`,
      tutorial: `${query} tutorial how to guide`,
      definition: `${query} definition meaning`,
      comparison: `${query} vs comparison`,
      review: `${query} review rating`,
      price: `${query} price cost buy`,
      location: `${query} location address where`
    };

    const modifiedQuery = typeModifiers[type] || query;
    return await this.search(modifiedQuery, maxResults);
  }

  /**
   * Get agent status and capabilities
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      available: true,
      supportedProviders: ['duckduckgo', 'bing', 'google'],
      features: [
        'Real-time web search',
        'Content extraction',
        'Information synthesis',
        'Specific search types',
        'Multiple search providers'
      ]
    };
  }
} 