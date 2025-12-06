/**
 * Financial NLP Engine
 * Specialized natural language processing for financial domain
 */

import natural from 'natural';
import compromise from 'compromise';
import { Logger } from '../core/logger.js';

export class FinancialNLPEngine {
  constructor() {
    this.logger = new Logger('FinancialNLP');
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;

    // Financial domain entities
    this.financialEntities = {
      insuranceCompanies: [
        'aetna', 'bcbs', 'blue cross', 'blue shield', 'humana', 'cigna',
        'anthem', 'molina', 'centene', 'wellcare', 'kaiser', 'uhc',
        'united healthcare', 'independence blue cross', 'highmark'
      ],
      metrics: [
        'revenue', 'cost', 'margin', 'profit', 'expense', 'budget',
        'variance', 'performance', 'utilization', 'volume', 'count',
        'rate', 'percentage', 'ratio', 'growth', 'change'
      ],
      timeframes: [
        'week', 'month', 'quarter', 'year', 'daily', 'weekly',
        'monthly', 'quarterly', 'annually', 'ytd', 'mtd'
      ],
      operations: [
        'over performed', 'under performed', 'met target', 'exceeded',
        'below target', 'improved', 'declined', 'stable'
      ]
    };

    // Intent patterns
    this.intentPatterns = {
      search: [
        /\b(find|show|list|display|get|fetch)\b/i,
        /\bwhat\s+(?:are|is)\b/i,
        /\bwhich\b/i
      ],
      count: [
        /\bhow\s+many\b/i,
        /\bcount\s+(?:of|the)?\b/i,
        /\bnumber\s+of\b/i,
        /\btotal\s+(?:count|number)?\b/i
      ],
      compare: [
        /\bcompare\b/i,
        /\bversus\b|\bvs\b/i,
        /\bdifference\s+between\b/i,
        /\bbetter\s+than\b|\bworse\s+than\b/i
      ],
      analyze: [
        /\banalyze\b|\banalysis\b/i,
        /\btrend\b|\bpattern\b/i,
        /\bover\s+time\b/i,
        /\bperformance\b/i
      ],
      aggregate: [
        /\bsum\b|\btotal\b/i,
        /\baverage\b|\bmean\b/i,
        /\bmax\b|\bmaximum\b/i,
        /\bmin\b|\bminimum\b/i
      ]
    };

    this.logger.info('Financial NLP Engine initialized');
  }

  /**
   * Process natural language query
   * @param {string} query - User query
   * @returns {Object} Processed query object
   */
  processQuery(query) {
    try {
      const startTime = Date.now();

      // Normalize query
      const normalizedQuery = this.normalizeQuery(query);

      // Extract entities
      const entities = this.extractEntities(normalizedQuery);

      // Determine intent
      const intent = this.classifyIntent(normalizedQuery);

      // Extract temporal context
      const temporal = this.extractTemporal(normalizedQuery);

      // Extract numerical context
      const numerical = this.extractNumerical(normalizedQuery);

      // Generate search terms
      const searchTerms = this.generateSearchTerms(normalizedQuery, entities);

      const processingTime = Date.now() - startTime;

      const result = {
        originalQuery: query,
        normalizedQuery,
        intent,
        entities,
        temporal,
        numerical,
        searchTerms,
        confidence: this.calculateConfidence(intent, entities),
        processingTime
      };

      this.logger.debug('Query processed:', result);
      return result;

    } catch (error) {
      this.logger.error('Error processing query:', error);
      throw error;
    }
  }

  /**
   * Normalize query text
   * @param {string} query - Raw query
   * @returns {string} Normalized query
   */
  normalizeQuery(query) {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\-]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Extract financial entities from query
   * @param {string} query - Normalized query
   * @returns {Object} Extracted entities
   */
  extractEntities(query) {
    const entities = {
      insuranceCompanies: [],
      metrics: [],
      operations: [],
      timeframes: []
    };

    // Extract insurance companies
    for (const company of this.financialEntities.insuranceCompanies) {
      if (query.includes(company)) {
        entities.insuranceCompanies.push(company);
      }
    }

    // Extract metrics
    for (const metric of this.financialEntities.metrics) {
      if (query.includes(metric)) {
        entities.metrics.push(metric);
      }
    }

    // Extract operations
    for (const operation of this.financialEntities.operations) {
      if (query.includes(operation)) {
        entities.operations.push(operation);
      }
    }

    // Extract timeframes
    for (const timeframe of this.financialEntities.timeframes) {
      if (query.includes(timeframe)) {
        entities.timeframes.push(timeframe);
      }
    }

    return entities;
  }

  /**
   * Classify query intent
   * @param {string} query - Normalized query
   * @returns {Object} Intent classification
   */
  classifyIntent(query) {
    const scores = {};

    // Score each intent based on pattern matches
    for (const [intentType, patterns] of Object.entries(this.intentPatterns)) {
      scores[intentType] = 0;

      for (const pattern of patterns) {
        if (pattern.test(query)) {
          scores[intentType] += 1;
        }
      }
    }

    // Find highest scoring intent
    const maxScore = Math.max(...Object.values(scores));
    const primaryIntent = Object.keys(scores).find(key => scores[key] === maxScore);

    // If no patterns match, default to search
    const intent = maxScore > 0 ? primaryIntent : 'search';
    const confidence = maxScore > 0 ? Math.min(maxScore * 0.3, 1.0) : 0.2;

    return {
      primary: intent,
      scores,
      confidence
    };
  }

  /**
   * Extract temporal context
   * @param {string} query - Normalized query
   * @returns {Object} Temporal information
   */
  extractTemporal(query) {
    const temporal = {
      explicit: [],
      relative: [],
      ranges: []
    };

    // Explicit dates/periods
    const datePatterns = [
      /\b(\d{4})\b/g,  // Years
      /\b(q[1-4])\b/gi, // Quarters
      /\b(week\s+\d+)\b/gi, // Week numbers
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = query.match(pattern);
      if (matches) {
        temporal.explicit.push(...matches);
      }
    }

    // Relative temporal expressions
    const relativePatterns = [
      /\b(last|previous|prior)\s+(week|month|quarter|year)\b/gi,
      /\b(this|current)\s+(week|month|quarter|year)\b/gi,
      /\b(next|following)\s+(week|month|quarter|year)\b/gi,
      /\b(over\s+time|historically|trending)\b/gi
    ];

    for (const pattern of relativePatterns) {
      const matches = query.match(pattern);
      if (matches) {
        temporal.relative.push(...matches);
      }
    }

    return temporal;
  }

  /**
   * Extract numerical context
   * @param {string} query - Normalized query
   * @returns {Object} Numerical information
   */
  extractNumerical(query) {
    const numerical = {
      values: [],
      operators: [],
      ranges: []
    };

    // Extract numbers
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const numbers = query.match(numberPattern);
    if (numbers) {
      numerical.values = numbers.map(Number);
    }

    // Extract comparison operators
    const operatorPatterns = [
      { pattern: /\b(greater|more|above|over|higher)\s+than\b/gi, operator: '>' },
      { pattern: /\b(less|fewer|below|under|lower)\s+than\b/gi, operator: '<' },
      { pattern: /\b(equal|equals|exactly)\b/gi, operator: '=' },
      { pattern: /\bbetween\b/gi, operator: 'between' }
    ];

    for (const { pattern, operator } of operatorPatterns) {
      if (pattern.test(query)) {
        numerical.operators.push(operator);
      }
    }

    return numerical;
  }

  /**
   * Generate search terms for data retrieval
   * @param {string} query - Normalized query
   * @param {Object} entities - Extracted entities
   * @returns {Array} Search terms
   */
  generateSearchTerms(query, entities) {
    const searchTerms = [];

    // Add entity-based terms
    searchTerms.push(...entities.insuranceCompanies);
    searchTerms.push(...entities.metrics);
    searchTerms.push(...entities.operations);

    // Extract key terms using compromise
    const doc = compromise(query);
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');

    searchTerms.push(...nouns, ...adjectives);

    // Remove common stop words
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];

    return [...new Set(searchTerms)]
      .filter(term => term.length > 2 && !stopWords.includes(term))
      .sort((a, b) => b.length - a.length); // Prioritize longer, more specific terms
  }

  /**
   * Calculate confidence score for the analysis
   * @param {Object} intent - Intent classification
   * @param {Object} entities - Extracted entities
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(intent, entities) {
    let confidence = intent.confidence || 0.2;

    // Boost confidence based on entity extraction
    const totalEntities = Object.values(entities).flat().length;
    confidence += Math.min(totalEntities * 0.1, 0.3);

    // Boost for financial-specific entities
    if (entities.insuranceCompanies.length > 0) confidence += 0.2;
    if (entities.metrics.length > 0) confidence += 0.2;
    if (entities.operations.length > 0) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  /**
   * Enhance entities dictionary with new terms
   * @param {string} category - Entity category
   * @param {Array} newTerms - New terms to add
   */
  enhanceEntities(category, newTerms) {
    if (this.financialEntities[category]) {
      const uniqueTerms = newTerms.filter(term =>
        !this.financialEntities[category].includes(term.toLowerCase())
      );

      this.financialEntities[category].push(...uniqueTerms.map(term => term.toLowerCase()));
      this.logger.info(`Enhanced ${category} with ${uniqueTerms.length} new terms`);
    }
  }

  /**
   * Get financial entity suggestions for query enhancement
   * @param {string} partialQuery - Partial query for suggestions
   * @returns {Array} Suggested entities
   */
  getSuggestions(partialQuery) {
    const suggestions = [];
    const query = partialQuery.toLowerCase();

    // Find matching entities
    for (const [category, entities] of Object.entries(this.financialEntities)) {
      const matches = entities.filter(entity =>
        entity.includes(query) || query.includes(entity)
      );

      suggestions.push(...matches.map(match => ({
        category,
        entity: match,
        relevance: this.calculateRelevance(query, match)
      })));
    }

    // Sort by relevance
    return suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  /**
   * Calculate relevance score for suggestion
   * @param {string} query - User query
   * @param {string} entity - Entity to score
   * @returns {number} Relevance score
   */
  calculateRelevance(query, entity) {
    if (entity.startsWith(query)) return 1.0;
    if (entity.includes(query)) return 0.8;
    if (query.includes(entity)) return 0.6;

    // Calculate edit distance for fuzzy matching
    const distance = natural.LevenshteinDistance(query, entity);
    const maxLength = Math.max(query.length, entity.length);
    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Get processing statistics
   * @returns {Object} Engine statistics
   */
  getStats() {
    return {
      entityCounts: Object.fromEntries(
        Object.entries(this.financialEntities).map(([key, value]) => [key, value.length])
      ),
      intentTypes: Object.keys(this.intentPatterns),
      version: '1.0.0'
    };
  }
}

export default FinancialNLPEngine;