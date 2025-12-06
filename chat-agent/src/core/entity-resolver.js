/**
 * Entity Resolver - Intelligent query transformation using taxonomy
 * Converts user queries into data-aware search instructions
 */

import { Logger } from './logger.js';

export class EntityResolver {
  constructor() {
    this.logger = new Logger('EntityResolver');
    this.taxonomy = null;
    this.columnAliases = new Map();
    this.setupColumnAliases();
  }

  /**
   * Initialize with taxonomy data
   * @param {Object} taxonomy - Built taxonomy from DataTaxonomyBuilder
   */
  initialize(taxonomy) {
    this.taxonomy = taxonomy;
    this.logger.info('Entity resolver initialized with taxonomy');
    this.logger.debug(`Tracking ${taxonomy.searchTermMap.size} search terms`);
  }

  /**
   * Setup column aliases for natural language column references
   */
  setupColumnAliases() {
    const aliases = [
      // Operational columns
      ['operational what went well', 'Operational - What Went Well'],
      ['operational went well', 'Operational - What Went Well'],
      ['operational good', 'Operational - What Went Well'],
      ['operational positive', 'Operational - What Went Well'],
      ['operational improvements', 'Operational - What Can Be Improved'],
      ['operational can be improved', 'Operational - What Can Be Improved'],
      ['operational issues', 'Operational - What Can Be Improved'],
      ['operational problems', 'Operational - What Can Be Improved'],

      // Revenue cycle columns
      ['revenue cycle went well', 'Revenue Cycle - What Went Well'],
      ['revenue cycle good', 'Revenue Cycle - What Went Well'],
      ['revenue cycle positive', 'Revenue Cycle - What Went Well'],
      ['revenue cycle improvements', 'Revenue Cycle - What Can Be Improved'],
      ['revenue cycle can be improved', 'Revenue Cycle - What Can Be Improved'],
      ['revenue cycle issues', 'Revenue Cycle - What Can Be Improved'],

      // Collection narrative
      ['zero balance collection', 'Zero-Balance Collection Narrative'],
      ['collection narrative', 'Zero-Balance Collection Narrative'],
      ['collection story', 'Zero-Balance Collection Narrative'],

      // Performance columns
      ['performance', 'Performance Diagnostic'],
      ['performance diagnostic', 'Performance Diagnostic']
    ];

    aliases.forEach(([alias, column]) => {
      this.columnAliases.set(alias.toLowerCase(), column);
    });

    this.logger.debug(`Setup ${this.columnAliases.size} column aliases`);
  }

  /**
   * Resolve a user query into actionable search parameters
   * @param {string} userQuery - Original user query
   * @param {Object} nlpResult - Basic NLP processing result
   * @returns {Object} Resolved query parameters
   */
  resolveQuery(userQuery, nlpResult) {
    const resolved = {
      originalQuery: userQuery,
      resolvedEntities: [],
      targetColumns: [],
      searchTerms: [],
      entityMappings: new Map(),
      confidence: 0
    };

    // Step 1: Resolve entities using taxonomy
    this.resolveEntities(userQuery, resolved);

    // Step 2: Identify target columns
    this.identifyTargetColumns(userQuery, resolved);

    // Step 3: Generate optimized search terms
    this.generateSearchTerms(resolved);

    // Step 4: Calculate confidence score
    resolved.confidence = this.calculateConfidence(resolved);

    this.logger.debug('Query resolved:', {
      entities: resolved.resolvedEntities.length,
      columns: resolved.targetColumns.length,
      searchTerms: resolved.searchTerms.length,
      confidence: resolved.confidence
    });

    return resolved;
  }

  /**
   * Resolve entities mentioned in the query
   */
  resolveEntities(userQuery, resolved) {
    if (!this.taxonomy || !this.taxonomy.searchTermMap) {
      this.logger.warn('Taxonomy not available for entity resolution');
      return;
    }

    const queryLower = userQuery.toLowerCase();
    const words = queryLower.split(/\s+/);
    const foundEntities = new Map();

    // Check each word and phrase for entity matches
    for (let i = 0; i < words.length; i++) {
      // Check single words
      this.checkEntityMatch(words[i], foundEntities);

      // Check two-word phrases
      if (i < words.length - 1) {
        const twoWord = `${words[i]} ${words[i + 1]}`;
        this.checkEntityMatch(twoWord, foundEntities);
      }

      // Check three-word phrases
      if (i < words.length - 2) {
        const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        this.checkEntityMatch(threeWord, foundEntities);
      }
    }

    // Convert found entities to resolved format
    for (const [term, entities] of foundEntities) {
      entities.forEach(entityInfo => {
        const resolvedEntity = {
          userTerm: term,
          entityType: entityInfo.type,
          resolvedValue: this.getEntityDataValue(entityInfo.entity),
          entity: entityInfo.entity,
          confidence: this.calculateEntityConfidence(term, entityInfo.entity)
        };

        resolved.resolvedEntities.push(resolvedEntity);
        resolved.entityMappings.set(entityInfo.type, resolvedEntity);

        this.logger.debug(`Resolved entity: "${term}" -> "${resolvedEntity.resolvedValue}" (${entityInfo.type})`);
      });
    }
  }

  /**
   * Check if a term matches any known entities
   */
  checkEntityMatch(term, foundEntities) {
    const normalizedTerm = term.toLowerCase();
    if (this.taxonomy.searchTermMap.has(normalizedTerm)) {
      if (!foundEntities.has(term)) {
        foundEntities.set(term, []);
      }
      foundEntities.get(term).push(...this.taxonomy.searchTermMap.get(normalizedTerm));
    }
  }

  /**
   * Get the actual data value for an entity
   */
  getEntityDataValue(entity) {
    if (entity.dataValue) {
      return entity.dataValue;
    }
    if (entity.fullName && entity.code) {
      return `${entity.code}-${entity.fullName}`;
    }
    return entity.displayName || entity.fullName || 'unknown';
  }

  /**
   * Identify target columns based on query context
   */
  identifyTargetColumns(userQuery, resolved) {
    const queryLower = userQuery.toLowerCase();

    // Direct column aliases
    for (const [alias, columnName] of this.columnAliases) {
      if (queryLower.includes(alias)) {
        resolved.targetColumns.push(columnName);
        this.logger.debug(`Identified target column via alias: "${alias}" -> "${columnName}"`);
      }
    }

    // Pattern-based column identification
    const columnPatterns = [
      {
        patterns: ['operational.*what went well', 'operational.*went well', 'operational.*positive'],
        column: 'Operational - What Went Well'
      },
      {
        patterns: ['operational.*what can be improved', 'operational.*improved', 'operational.*issues'],
        column: 'Operational - What Can Be Improved'
      },
      {
        patterns: ['revenue cycle.*what went well', 'revenue cycle.*went well', 'revenue cycle.*positive'],
        column: 'Revenue Cycle - What Went Well'
      },
      {
        patterns: ['revenue cycle.*what can be improved', 'revenue cycle.*improved', 'revenue cycle.*issues'],
        column: 'Revenue Cycle - What Can Be Improved'
      },
      {
        patterns: ['zero.?balance.*collection', 'collection narrative'],
        column: 'Zero-Balance Collection Narrative'
      }
    ];

    columnPatterns.forEach(({ patterns, column }) => {
      if (patterns.some(pattern => new RegExp(pattern, 'i').test(queryLower))) {
        if (!resolved.targetColumns.includes(column)) {
          resolved.targetColumns.push(column);
          this.logger.debug(`Identified target column via pattern: "${column}"`);
        }
      }
    });

    // If no specific columns identified, but we have entities, infer likely columns
    if (resolved.targetColumns.length === 0 && resolved.resolvedEntities.length > 0) {
      this.inferLikelyColumns(resolved);
    }
  }

  /**
   * Infer likely columns based on resolved entities
   */
  inferLikelyColumns(resolved) {
    const hasInsuranceEntity = resolved.resolvedEntities.some(e => e.entityType === 'insurance_company');
    const hasPerformanceEntity = resolved.resolvedEntities.some(e => e.entityType === 'performance_category');

    if (hasInsuranceEntity) {
      // Insurance companies are most commonly mentioned in narrative columns
      this.taxonomy.narrativeColumns.forEach(column => {
        resolved.targetColumns.push(column);
      });
      this.logger.debug('Inferred narrative columns for insurance entity');
    }

    if (hasPerformanceEntity) {
      resolved.targetColumns.push('Performance Diagnostic');
      this.logger.debug('Inferred Performance Diagnostic column for performance entity');
    }
  }

  /**
   * Generate optimized search terms
   */
  generateSearchTerms(resolved) {
    // Add resolved entity values as primary search terms
    resolved.resolvedEntities.forEach(entity => {
      if (entity.resolvedValue) {
        resolved.searchTerms.push(entity.resolvedValue);
      }
    });

    // Add secondary search terms from entity aliases
    resolved.resolvedEntities.forEach(entity => {
      if (entity.entity.aliases && Array.isArray(entity.entity.aliases)) {
        entity.entity.aliases.slice(0, 3).forEach(alias => { // Limit to prevent explosion
          if (alias !== entity.resolvedValue) {
            resolved.searchTerms.push(alias);
          }
        });
      }
    });

    // Remove duplicates and sort by relevance
    resolved.searchTerms = [...new Set(resolved.searchTerms)]
      .sort((a, b) => {
        // Prioritize exact data values over aliases
        const aIsPrimary = resolved.resolvedEntities.some(e => e.resolvedValue === a);
        const bIsPrimary = resolved.resolvedEntities.some(e => e.resolvedValue === b);

        if (aIsPrimary && !bIsPrimary) return -1;
        if (!aIsPrimary && bIsPrimary) return 1;
        return 0;
      });

    this.logger.debug(`Generated ${resolved.searchTerms.length} search terms:`, resolved.searchTerms);
  }

  /**
   * Calculate entity match confidence
   */
  calculateEntityConfidence(userTerm, entity) {
    let confidence = 0.5; // Base confidence

    // Exact match bonus
    if (entity.searchTerms && entity.searchTerms.includes(userTerm)) {
      confidence += 0.3;
    }

    // Partial match bonus
    if (entity.fullName && entity.fullName.toLowerCase().includes(userTerm.toLowerCase())) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate overall resolution confidence
   */
  calculateConfidence(resolved) {
    let confidence = 0.3; // Base confidence

    // Entity resolution bonus
    if (resolved.resolvedEntities.length > 0) {
      confidence += 0.3;
      // Boost for high-confidence entities
      const avgEntityConfidence = resolved.resolvedEntities
        .reduce((sum, e) => sum + (e.confidence || 0.5), 0) / resolved.resolvedEntities.length;
      confidence += avgEntityConfidence * 0.2;
    }

    // Column identification bonus
    if (resolved.targetColumns.length > 0) {
      confidence += 0.2;
    }

    // Search term generation bonus
    if (resolved.searchTerms.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get entity suggestions for partial matches
   */
  getSuggestions(partialQuery) {
    const suggestions = [];
    const queryLower = partialQuery.toLowerCase();

    if (!this.taxonomy || !this.taxonomy.searchTermMap) {
      return suggestions;
    }

    // Find partial matches
    for (const [term, entities] of this.taxonomy.searchTermMap) {
      if (term.includes(queryLower) || queryLower.includes(term)) {
        entities.forEach(entityInfo => {
          const suggestion = {
            term: term,
            type: entityInfo.type,
            displayName: entityInfo.entity.fullName || entityInfo.entity.displayName,
            confidence: this.calculateSuggestionConfidence(queryLower, term)
          };
          suggestions.push(suggestion);
        });
      }
    }

    // Sort by confidence and limit results
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Calculate suggestion confidence
   */
  calculateSuggestionConfidence(query, term) {
    if (term.startsWith(query)) return 0.9;
    if (term.includes(query)) return 0.7;
    if (query.includes(term)) return 0.5;
    return 0.3;
  }
}

export default EntityResolver;