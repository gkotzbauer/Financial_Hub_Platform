/**
 * Query Agent - Specialized agent for processing financial data queries
 * Handles search, filtering, and basic aggregation operations
 */

import { BaseAgent } from '../core/base-agent.js';
import { FinancialNLPEngine } from '../nlp/financial-nlp-engine.js';
import { DataTaxonomyBuilder } from '../core/data-taxonomy-builder.js';
import { EntityResolver } from '../core/entity-resolver.js';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';

export class QueryAgent extends BaseAgent {
  constructor() {
    super('query', ['search', 'filter', 'count', 'aggregate', 'find']);
    this.nlpEngine = new FinancialNLPEngine();
    this.dataCache = new Map();
    this.dataSchema = new Map();
    this.taxonomyBuilder = new DataTaxonomyBuilder();
    this.entityResolver = new EntityResolver();
    this.taxonomy = null;
  }

  async initialize() {
    await super.initialize();
    await this.loadAvailableDataSources();

    // Build taxonomy from loaded data - this is the key step!
    this.logger.info('Building data taxonomy...');
    this.taxonomy = await this.taxonomyBuilder.buildTaxonomy(this.dataCache, this.dataSchema);

    // Initialize entity resolver with taxonomy
    this.entityResolver.initialize(this.taxonomy);

    this.logger.info('Query agent initialized with taxonomy-driven intelligence');
  }

  /**
   * Perform query action
   * @param {string} action - Action to perform
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Query results
   */
  async performAction(action, context) {
    const { request } = context;

    this.validateParams(request, ['query']);

    const processedQuery = this.nlpEngine.processQuery(request.query);
    this.logger.debug('Processed query:', processedQuery);

    switch (action) {
      case 'search':
      case 'find':
        return await this.executeSearch(processedQuery, request);

      case 'count':
        return await this.executeCount(processedQuery, request);

      case 'aggregate':
        return await this.executeAggregation(processedQuery, request);

      case 'filter':
        return await this.executeFilter(processedQuery, request);

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  /**
   * Load available data sources and cache metadata
   */
  async loadAvailableDataSources() {
    const dataDir = path.join(process.cwd(), '..', 'data');

    if (!fs.existsSync(dataDir)) {
      this.logger.warn('Data directory not found, creating...');
      fs.mkdirSync(dataDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(dataDir);

    for (const file of files) {
      if (this.isSupportedFileType(file)) {
        try {
          await this.loadDataSource(path.join(dataDir, file));
          this.logger.info(`Loaded data source: ${file}`);
        } catch (error) {
          this.logger.error(`Failed to load ${file}:`, error);
        }
      }
    }
  }

  /**
   * Check if file type is supported
   * @param {string} filename - File name
   * @returns {boolean} Is supported
   */
  isSupportedFileType(filename) {
    const supportedExtensions = ['.csv', '.json'];
    const ext = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * Load a single data source
   * @param {string} filePath - Path to data file
   */
  async loadDataSource(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    let data;
    let schema;

    switch (ext) {
      case '.csv':
        ({ data, schema } = await this.loadCsvFile(filePath));
        break;

      case '.json':
        ({ data, schema } = await this.loadJsonFile(filePath));
        break;

      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Cache data and schema
    this.dataCache.set(filename, data);
    this.dataSchema.set(filename, schema);
  }


  /**
   * Load CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Object} Data and schema
   */
  async loadCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const data = [];

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => data.push(row))
        .on('end', () => {
          const schema = this.inferSchema(data);
          resolve({
            data: { [path.basename(filePath, '.csv')]: data },
            schema: { [path.basename(filePath, '.csv')]: schema }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Load JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Object} Data and schema
   */
  async loadJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(content);

    // Handle both array and object structures
    const data = Array.isArray(jsonData) ? jsonData : [jsonData];
    const schema = this.inferSchema(data);

    return {
      data: { [path.basename(filePath, '.json')]: data },
      schema: { [path.basename(filePath, '.json')]: schema }
    };
  }

  /**
   * Infer schema from data sample
   * @param {Array} data - Data array
   * @returns {Object} Schema object
   */
  inferSchema(data) {
    if (!data || data.length === 0) return {};

    const schema = {};
    const sample = data.slice(0, Math.min(100, data.length)); // Sample first 100 rows

    // Get all possible columns
    const allColumns = new Set();
    sample.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });

    // Analyze each column
    for (const column of allColumns) {
      const values = sample
        .map(row => row[column])
        .filter(val => val !== null && val !== undefined && val !== '');

      schema[column] = {
        type: this.inferColumnType(values),
        nullable: values.length < sample.length,
        unique: new Set(values).size === values.length,
        sampleValues: [...new Set(values)].slice(0, 10)
      };
    }

    return schema;
  }

  /**
   * Infer column data type
   * @param {Array} values - Column values
   * @returns {string} Data type
   */
  inferColumnType(values) {
    if (values.length === 0) return 'unknown';

    const types = {
      number: 0,
      date: 0,
      boolean: 0,
      string: 0
    };

    for (const value of values) {
      if (typeof value === 'number' || (!isNaN(Number(value)) && value !== '')) {
        types.number++;
      } else if (this.isDateString(value)) {
        types.date++;
      } else if (typeof value === 'boolean' || ['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
        types.boolean++;
      } else {
        types.string++;
      }
    }

    // Return type with highest count
    return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
  }

  /**
   * Check if string represents a date
   * @param {string} value - Value to check
   * @returns {boolean} Is date string
   */
  isDateString(value) {
    const date = new Date(value);
    return !isNaN(date.getTime()) && value.toString().match(/\d{4}|\d{1,2}\/\d{1,2}/);
  }

  /**
   * Execute taxonomy-driven search operation
   * @param {Object} processedQuery - Processed NLP query
   * @param {Object} request - Original request
   * @returns {Object} Search results
   */
  async executeSearch(processedQuery, request) {
    this.logger.info(`Executing taxonomy-driven search for: "${processedQuery.originalQuery}"`);

    // Step 1: Use EntityResolver to understand what the user is really asking for
    const resolvedQuery = this.entityResolver.resolveQuery(processedQuery.originalQuery, processedQuery);

    this.logger.info(`Query resolution result:`, {
      entities: resolvedQuery.resolvedEntities.length,
      columns: resolvedQuery.targetColumns.length,
      searchTerms: resolvedQuery.searchTerms.length,
      confidence: resolvedQuery.confidence
    });

    // Log resolved entities for debugging
    resolvedQuery.resolvedEntities.forEach(entity => {
      this.logger.info(`Resolved entity: "${entity.userTerm}" -> "${entity.resolvedValue}" (${entity.entityType})`);
    });

    // Log target columns for debugging
    resolvedQuery.targetColumns.forEach(column => {
      this.logger.info(`Target column: "${column}"`);
    });

    const results = [];

    // Step 2: Execute intelligent search with resolved parameters
    for (const [filename, data] of this.dataCache) {
      const schema = this.dataSchema.get(filename);

      for (const [sheetName, sheetData] of Object.entries(data)) {
        const matches = this.taxonomyDrivenSearch(
          sheetData,
          resolvedQuery.searchTerms,
          resolvedQuery.targetColumns,
          resolvedQuery.resolvedEntities,
          schema[sheetName]
        );

        if (matches.length > 0) {
          results.push({
            source: filename,
            sheet: sheetName,
            matches: matches.slice(0, 50), // Limit results
            totalMatches: matches.length,
            searchedColumn: resolvedQuery.targetColumns.join(', ') || 'all columns',
            resolvedEntities: resolvedQuery.resolvedEntities,
            confidence: resolvedQuery.confidence
          });

          this.logger.info(`Found ${matches.length} matches in ${filename}/${sheetName}`);
        }
      }
    }

    return {
      query: processedQuery.originalQuery,
      intent: processedQuery.intent,
      results,
      totalSources: results.length,
      processingTime: processedQuery.processingTime,
      resolvedQuery: resolvedQuery,
      searchedIn: resolvedQuery.targetColumns.join(', ') || 'all columns'
    };
  }

  /**
   * Taxonomy-driven intelligent search
   * @param {Array} data - Dataset to search
   * @param {Array} searchTerms - Resolved search terms from EntityResolver
   * @param {Array} targetColumns - Identified target columns
   * @param {Array} resolvedEntities - Resolved entities with confidence
   * @param {Object} schema - Data schema
   * @returns {Array} Matching rows
   */
  taxonomyDrivenSearch(data, searchTerms, targetColumns, resolvedEntities, schema) {
    if (!Array.isArray(data) || searchTerms.length === 0) {
      return [];
    }

    this.logger.debug(`Searching ${data.length} records with ${searchTerms.length} terms in ${targetColumns.length} columns`);

    return data.filter(row => {
      // If we have specific target columns, search only in those
      if (targetColumns.length > 0) {
        return targetColumns.some(columnName => {
          const columnValue = row[columnName];
          if (columnValue === null || columnValue === undefined) return false;

          return searchTerms.some(term => {
            const match = String(columnValue).toLowerCase().includes(term.toLowerCase());
            if (match) {
              this.logger.debug(`Match found: "${term}" in ${columnName} -> "${String(columnValue).substring(0, 100)}..."`);
            }
            return match;
          });
        });
      } else {
        // Fallback: search across all columns
        return searchTerms.some(term => {
          return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            const match = String(value).toLowerCase().includes(term.toLowerCase());
            if (match) {
              this.logger.debug(`Match found: "${term}" in row -> "${String(value).substring(0, 100)}..."`);
            }
            return match;
          });
        });
      }
    });
  }

  /**
   * Legacy search method (for backward compatibility)
   * @param {Array} data - Dataset to search
   * @param {Array} searchTerms - Terms to search for
   * @param {Object} schema - Data schema
   * @param {string} specificColumn - Optional specific column to search in
   * @returns {Array} Matching rows
   */
  searchInDataSet(data, searchTerms, schema, specificColumn = null) {
    if (!Array.isArray(data) || searchTerms.length === 0) return [];

    return data.filter(row => {
      return searchTerms.some(term => {
        if (specificColumn) {
          // Search only in the specified column
          const value = row[specificColumn];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(term.toLowerCase());
        } else {
          // Search across all columns
          return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(term.toLowerCase());
          });
        }
      });
    });
  }

  /**
   * Execute count operation
   * @param {Object} processedQuery - Processed NLP query
   * @param {Object} request - Original request
   * @returns {Object} Count results
   */
  async executeCount(processedQuery, request) {
    const results = [];

    // Look for specific count patterns
    const query = processedQuery.originalQuery.toLowerCase();

    // Check for performance type queries
    if (query.includes('over performed') || query.includes('overperformed')) {
      for (const [filename, data] of this.dataCache) {
        for (const [sheetName, sheetData] of Object.entries(data)) {
          const count = this.countPerformanceType(sheetData, 'over');
          if (count > 0) {
            results.push({
              source: filename,
              sheet: sheetName,
              metric: 'Over Performed',
              count
            });
          }
        }
      }
    } else if (query.includes('under performed') || query.includes('underperformed')) {
      for (const [filename, data] of this.dataCache) {
        for (const [sheetName, sheetData] of Object.entries(data)) {
          const count = this.countPerformanceType(sheetData, 'under');
          if (count > 0) {
            results.push({
              source: filename,
              sheet: sheetName,
              metric: 'Under Performed',
              count
            });
          }
        }
      }
    } else if (query.includes('average performance')) {
      for (const [filename, data] of this.dataCache) {
        for (const [sheetName, sheetData] of Object.entries(data)) {
          const count = this.countPerformanceType(sheetData, 'average');
          if (count > 0) {
            results.push({
              source: filename,
              sheet: sheetName,
              metric: 'Average Performance',
              count
            });
          }
        }
      }
    } else {
      // General counting based on search terms
      const searchResults = await this.executeSearch(processedQuery, request);

      for (const result of searchResults.results) {
        results.push({
          source: result.source,
          sheet: result.sheet,
          metric: 'Matching Records',
          count: result.totalMatches
        });
      }
    }

    return {
      query: processedQuery.originalQuery,
      intent: processedQuery.intent,
      counts: results,
      totalCount: results.reduce((sum, r) => sum + r.count, 0)
    };
  }

  /**
   * Count performance type occurrences
   * @param {Array} data - Dataset
   * @param {string} type - 'over', 'under', or 'average'
   * @returns {number} Count of performance items
   */
  countPerformanceType(data, type) {
    if (!Array.isArray(data)) return 0;

    // Define the column names to check based on type
    let columnName;
    let searchTerms;

    switch(type) {
      case 'over':
        columnName = 'Over Performed';
        searchTerms = ['over performed', 'overperformed'];
        break;
      case 'under':
        columnName = 'Under Performed';
        searchTerms = ['under performed', 'underperformed'];
        break;
      case 'average':
        columnName = 'Average Performance';
        searchTerms = ['average performance'];
        break;
      default:
        return 0;
    }

    // Count rows where the specific column has value 1
    return data.reduce((count, row) => {
      // Check the specific column if it exists
      if (row[columnName] !== undefined) {
        const value = row[columnName];
        if (value === 1 || value === '1' || value === true) {
          return count + 1;
        }
      }

      // Also check Performance Diagnostic column for text matches
      if (row['Performance Diagnostic']) {
        const diagnostic = String(row['Performance Diagnostic']).toLowerCase();
        if (searchTerms.some(term => diagnostic.includes(term))) {
          return count + 1;
        }
      }

      return count;
    }, 0);
  }

  /**
   * Execute aggregation operation
   * @param {Object} processedQuery - Processed NLP query
   * @param {Object} request - Original request
   * @returns {Object} Aggregation results
   */
  async executeAggregation(processedQuery, request) {
    const results = [];

    for (const [filename, data] of this.dataCache) {
      const schema = this.dataSchema.get(filename);

      for (const [sheetName, sheetData] of Object.entries(data)) {
        const aggregations = this.calculateAggregations(sheetData, schema[sheetName], processedQuery);

        if (Object.keys(aggregations).length > 0) {
          results.push({
            source: filename,
            sheet: sheetName,
            aggregations
          });
        }
      }
    }

    return {
      query: processedQuery.originalQuery,
      intent: processedQuery.intent,
      results
    };
  }

  /**
   * Calculate aggregations for numeric columns
   * @param {Array} data - Dataset
   * @param {Object} schema - Data schema
   * @param {Object} processedQuery - Processed query
   * @returns {Object} Aggregation results
   */
  calculateAggregations(data, schema, processedQuery) {
    const aggregations = {};

    // Find numeric columns
    const numericColumns = Object.keys(schema).filter(col => schema[col].type === 'number');

    for (const column of numericColumns) {
      const values = data
        .map(row => Number(row[column]))
        .filter(val => !isNaN(val));

      if (values.length > 0) {
        aggregations[column] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }

    return aggregations;
  }

  /**
   * Execute filter operation
   * @param {Object} processedQuery - Processed NLP query
   * @param {Object} request - Original request
   * @returns {Object} Filter results
   */
  async executeFilter(processedQuery, request) {
    // For now, filter is similar to search but with more specific criteria
    const searchResults = await this.executeSearch(processedQuery, request);

    return {
      ...searchResults,
      operation: 'filter'
    };
  }

  /**
   * Get available data sources info
   * @returns {Object} Data sources information
   */
  getDataSourcesInfo() {
    const sources = [];

    for (const [filename, data] of this.dataCache) {
      const schema = this.dataSchema.get(filename);

      sources.push({
        filename,
        sheets: Object.keys(data),
        totalRecords: Object.values(data).reduce((sum, sheet) => sum + sheet.length, 0),
        columns: Object.keys(schema).reduce((all, sheet) => ({
          ...all,
          [sheet]: Object.keys(schema[sheet])
        }), {})
      });
    }

    return {
      totalSources: sources.length,
      sources
    };
  }

  /**
   * Calculate confidence for query results
   * @param {Object} result - Query result
   * @param {Object} context - Execution context
   * @returns {number} Confidence score
   */
  calculateConfidence(result, context) {
    let confidence = super.calculateConfidence(result, context);

    // Boost confidence based on result specificity
    if (result.results && result.results.length > 0) {
      confidence += 0.2;
    }

    // Boost for exact entity matches
    if (result.intent && result.intent.confidence > 0.7) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}

export default QueryAgent;