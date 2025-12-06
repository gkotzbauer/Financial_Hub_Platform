/**
 * Data Taxonomy Builder - Analyzes loaded data to build comprehensive entity knowledge base
 * This is the "brain" that makes the system aware of what data actually exists
 */

import { Logger } from './logger.js';

export class DataTaxonomyBuilder {
  constructor() {
    this.logger = new Logger('DataTaxonomy');
    this.taxonomy = {
      insuranceCompanies: new Map(),
      performanceCategories: new Map(),
      metrics: new Map(),
      narrativeColumns: new Set(),
      metricColumns: new Set(),
      identifierColumns: new Set(),
      allColumns: new Set(),
      columnMappings: new Map(),
      entityPatterns: new Map()
    };
  }

  /**
   * Build comprehensive taxonomy from loaded data
   * @param {Map} dataCache - The loaded data cache from QueryAgent
   * @param {Map} dataSchema - The data schema from QueryAgent
   * @returns {Object} Complete taxonomy structure
   */
  async buildTaxonomy(dataCache, dataSchema) {
    this.logger.info('Starting comprehensive data taxonomy build...');

    for (const [filename, data] of dataCache) {
      this.logger.info(`Analyzing data source: ${filename}`);

      for (const [sheetName, sheetData] of Object.entries(data)) {
        await this.analyzeDataSheet(sheetData, sheetName, filename);
      }
    }

    // Post-process to create intelligent mappings
    this.buildIntelligentMappings();

    this.logger.info('Data taxonomy build complete');
    this.logTaxonomyStats();

    return this.getTaxonomy();
  }

  /**
   * Analyze a single sheet of data to extract entities and patterns
   */
  async analyzeDataSheet(sheetData, sheetName, filename) {
    if (!Array.isArray(sheetData) || sheetData.length === 0) {
      this.logger.warn(`No data found in sheet: ${sheetName}`);
      return;
    }

    const sampleSize = Math.min(sheetData.length, 100); // Analyze all data, not just sample
    this.logger.info(`Analyzing ${sheetData.length} records from ${sheetName}`);

    // Get all columns from the data
    const allColumns = new Set();
    sheetData.forEach(row => {
      Object.keys(row).forEach(col => allColumns.add(col));
    });

    // Categorize columns by their purpose
    this.categorizeColumns(allColumns);

    // Extract entities from narrative columns
    this.extractInsuranceCompanies(sheetData);

    // Extract performance categories
    this.extractPerformanceCategories(sheetData);

    // Extract metrics and their patterns
    this.extractMetrics(sheetData, allColumns);

    // Analyze narrative patterns
    this.analyzeNarrativePatterns(sheetData);
  }

  /**
   * Categorize columns by their semantic purpose
   */
  categorizeColumns(columns) {
    const narrativeKeywords = ['operational', 'revenue cycle', 'narrative', 'what went well', 'what can be improved'];
    const metricKeywords = [
      'visit count', 'per visit', 'amount', 'rate', 'percentage', '%', 'avg', 'charge',
      'balance', 'collection', 'denial', 'payment', 'error', 'gap', 'benchmark',
      'revenue', 'performed', 'diagnostic', 'lift', 'missed', 'expected', 'nrv'
    ];

    // Track all columns for comprehensive taxonomy
    const allColumns = new Set();
    const identifierColumns = new Set(); // Year, Week, ID columns

    for (const column of columns) {
      const columnLower = column.toLowerCase();
      allColumns.add(column);

      // Identify narrative columns (text-based analysis columns)
      if (narrativeKeywords.some(keyword => columnLower.includes(keyword))) {
        this.taxonomy.narrativeColumns.add(column);
        this.logger.debug(`Identified narrative column: ${column}`);
      }
      // Identify identifier/dimensional columns
      else if (['year', 'week', 'month', 'quarter', 'id'].some(keyword => columnLower.includes(keyword))) {
        identifierColumns.add(column);
        this.logger.debug(`Identified identifier column: ${column}`);
      }
      // Identify metric columns (everything else that's measurable)
      else if (metricKeywords.some(keyword => columnLower.includes(keyword)) ||
          /^\d+$/.test(column) || // Numeric column names
          columnLower.includes('performance') ||
          // Catch common financial/medical metrics patterns
          columnLower.match(/^(over|under|average|above|below|volume)/) ||
          columnLower.includes('$') ||
          columnLower.includes('(rf)')) {
        this.taxonomy.metricColumns.add(column);
        this.logger.debug(`Identified metric column: ${column}`);
      }
      // Default: treat unknown columns as metrics for searchability
      else {
        this.taxonomy.metricColumns.add(column);
        this.logger.debug(`Classified unknown column as metric: ${column}`);
      }
    }

    // Store comprehensive column inventory
    this.taxonomy.allColumns = allColumns;
    this.taxonomy.identifierColumns = identifierColumns;

    this.logger.info(`Categorized ${allColumns.size} total columns: ${this.taxonomy.narrativeColumns.size} narrative, ${this.taxonomy.metricColumns.size} metric, ${identifierColumns.size} identifier`);
  }

  /**
   * Extract insurance company entities from narrative data
   * Critical: This maps user terms to actual data values
   */
  extractInsuranceCompanies(sheetData) {
    // Pattern: NN-COMPANY_NAME where NN is 1-2 digits
    const insurancePattern = /(\d{1,2})-([A-Z][A-Z\s]+[A-Z])/g;
    const foundCompanies = new Set();

    // Scan narrative columns for insurance company mentions
    sheetData.forEach(row => {
      for (const column of this.taxonomy.narrativeColumns) {
        const value = row[column];
        if (typeof value === 'string') {
          let match;
          while ((match = insurancePattern.exec(value)) !== null) {
            const code = match[1];
            const name = match[2];
            const fullCode = `${code}-${name}`;
            foundCompanies.add(fullCode);
          }
        }
      }
    });

    // Build intelligent mapping for each company
    foundCompanies.forEach(fullCode => {
      const [code, name] = fullCode.split('-', 2);
      const company = {
        code: code,
        fullName: name,
        dataValue: fullCode, // What appears in the actual data
        aliases: this.generateAliases(name),
        searchTerms: this.generateSearchTerms(name)
      };

      this.taxonomy.insuranceCompanies.set(name.toLowerCase(), company);
      this.logger.debug(`Mapped insurance company: ${name} -> ${fullCode}`);
    });

    this.logger.info(`Extracted ${this.taxonomy.insuranceCompanies.size} insurance companies`);
  }

  /**
   * Generate intelligent aliases for an insurance company name
   */
  generateAliases(companyName) {
    const aliases = new Set();
    const name = companyName.toLowerCase();

    // Add exact variations
    aliases.add(companyName); // Original case
    aliases.add(name); // Lowercase
    aliases.add(companyName.toUpperCase()); // Uppercase

    // Add common abbreviations and variations
    const abbreviationMap = {
      'aetna': ['aetna'],
      'bcbs': ['blue cross blue shield', 'blue cross', 'bcbs'],
      'united healthcare': ['united', 'uhc', 'united healthcare'],
      'cigna': ['cigna'],
      'humana': ['humana'],
      'medicare': ['medicare'],
      'medicaid': ['medicaid'],
      'tricare': ['tricare'],
      'work comp': ['workers comp', 'workers compensation', 'work comp', 'workcomp'],
      'commercial': ['commercial'],
      'eps': ['eps'],
      'ppo': ['ppo']
    };

    // Find matching abbreviations
    for (const [abbrev, variations] of Object.entries(abbreviationMap)) {
      if (name.includes(abbrev) || variations.some(v => name.includes(v))) {
        variations.forEach(variation => {
          aliases.add(variation);
          aliases.add(variation.toUpperCase());
        });
      }
    }

    return Array.from(aliases);
  }

  /**
   * Generate search terms that should resolve to this company
   */
  generateSearchTerms(companyName) {
    const terms = new Set();
    const name = companyName.toLowerCase();

    // Add the company name parts
    terms.add(name);
    name.split(' ').forEach(part => {
      if (part.length > 2) { // Skip very short words
        terms.add(part);
      }
    });

    return Array.from(terms);
  }

  /**
   * Extract performance categories from data
   */
  extractPerformanceCategories(sheetData) {
    const perfColumn = 'Performance Diagnostic';
    const categories = new Set();

    sheetData.forEach(row => {
      if (row[perfColumn]) {
        categories.add(row[perfColumn]);
      }
    });

    categories.forEach(category => {
      const categoryData = {
        displayName: category,
        searchTerms: this.generatePerformanceSearchTerms(category),
        dataValue: category
      };

      this.taxonomy.performanceCategories.set(category.toLowerCase(), categoryData);
      this.logger.debug(`Mapped performance category: ${category}`);
    });

    this.logger.info(`Extracted ${categories.size} performance categories`);
  }

  /**
   * Generate search terms for performance categories
   */
  generatePerformanceSearchTerms(category) {
    const terms = new Set();
    const lower = category.toLowerCase();

    terms.add(lower);
    terms.add(category);

    // Handle variations
    if (lower.includes('over performed')) {
      terms.add('overperformed');
      terms.add('over performed');
      terms.add('over-performed');
    }

    if (lower.includes('under performed')) {
      terms.add('underperformed');
      terms.add('under performed');
      terms.add('under-performed');
    }

    if (lower.includes('average performance')) {
      terms.add('average performance');
      terms.add('average');
    }

    return Array.from(terms);
  }

  /**
   * Extract metrics and their patterns
   */
  extractMetrics(sheetData, columns) {
    // Identify numeric columns and their value patterns
    for (const column of columns) {
      if (this.taxonomy.metricColumns.has(column)) {
        const values = sheetData
          .map(row => row[column])
          .filter(val => val !== null && val !== undefined && val !== '')
          .slice(0, 100); // Sample for performance

        if (values.length > 0) {
          const metricInfo = {
            columnName: column,
            sampleValues: values.slice(0, 10),
            isNumeric: values.every(val => !isNaN(Number(val))),
            searchTerms: this.generateMetricSearchTerms(column)
          };

          this.taxonomy.metrics.set(column.toLowerCase(), metricInfo);
        }
      }
    }
  }

  /**
   * Generate search terms for metrics
   */
  generateMetricSearchTerms(columnName) {
    const terms = new Set();
    const lower = columnName.toLowerCase();

    terms.add(lower);
    terms.add(columnName);

    // Break down compound metric names
    const words = lower.split(/[\s\-_]+/);
    words.forEach(word => {
      if (word.length > 2) {
        terms.add(word);
      }
    });

    return Array.from(terms);
  }

  /**
   * Analyze narrative patterns to understand content structure
   */
  analyzeNarrativePatterns(sheetData) {
    for (const column of this.taxonomy.narrativeColumns) {
      const patterns = {
        commonPrefixes: new Map(),
        commonSuffixes: new Map(),
        entityMentions: new Map()
      };

      sheetData.forEach(row => {
        const value = row[column];
        if (typeof value === 'string' && value.length > 0) {
          // Analyze patterns in narrative text
          const segments = value.split(';').map(s => s.trim());
          segments.forEach(segment => {
            // Extract company mentions and their contexts
            const insurancePattern = /(\d{1,2}-[A-Z\s]+)/g;
            let match;
            while ((match = insurancePattern.exec(segment)) !== null) {
              const company = match[1];
              if (!patterns.entityMentions.has(company)) {
                patterns.entityMentions.set(company, []);
              }
              patterns.entityMentions.get(company).push(segment);
            }
          });
        }
      });

      this.taxonomy.entityPatterns.set(column, patterns);
    }
  }

  /**
   * Build intelligent mappings for query resolution
   */
  buildIntelligentMappings() {
    // Create reverse mappings for fast lookup
    const searchTermMap = new Map();

    // Map insurance company terms
    for (const [key, company] of this.taxonomy.insuranceCompanies) {
      company.searchTerms.forEach(term => {
        if (!searchTermMap.has(term.toLowerCase())) {
          searchTermMap.set(term.toLowerCase(), []);
        }
        searchTermMap.get(term.toLowerCase()).push({
          type: 'insurance_company',
          entity: company
        });
      });
    }

    // Map performance category terms
    for (const [key, category] of this.taxonomy.performanceCategories) {
      category.searchTerms.forEach(term => {
        if (!searchTermMap.has(term.toLowerCase())) {
          searchTermMap.set(term.toLowerCase(), []);
        }
        searchTermMap.get(term.toLowerCase()).push({
          type: 'performance_category',
          entity: category
        });
      });
    }

    this.taxonomy.searchTermMap = searchTermMap;
    this.logger.info(`Built search term mappings for ${searchTermMap.size} terms`);
  }

  /**
   * Get the complete taxonomy
   */
  getTaxonomy() {
    return {
      insuranceCompanies: this.taxonomy.insuranceCompanies,
      performanceCategories: this.taxonomy.performanceCategories,
      metrics: this.taxonomy.metrics,
      narrativeColumns: Array.from(this.taxonomy.narrativeColumns),
      metricColumns: Array.from(this.taxonomy.metricColumns),
      identifierColumns: Array.from(this.taxonomy.identifierColumns),
      allColumns: Array.from(this.taxonomy.allColumns),
      entityPatterns: this.taxonomy.entityPatterns,
      searchTermMap: this.taxonomy.searchTermMap
    };
  }

  /**
   * Log taxonomy statistics
   */
  logTaxonomyStats() {
    this.logger.info('=== Taxonomy Statistics ===');
    this.logger.info(`Insurance Companies: ${this.taxonomy.insuranceCompanies.size}`);
    this.logger.info(`Performance Categories: ${this.taxonomy.performanceCategories.size}`);
    this.logger.info(`Metrics: ${this.taxonomy.metrics.size}`);
    this.logger.info(`All Columns: ${this.taxonomy.allColumns.size}`);
    this.logger.info(`Narrative Columns: ${this.taxonomy.narrativeColumns.size}`);
    this.logger.info(`Metric Columns: ${this.taxonomy.metricColumns.size}`);
    this.logger.info(`Identifier Columns: ${this.taxonomy.identifierColumns.size}`);
    this.logger.info(`Search Terms: ${this.taxonomy.searchTermMap?.size || 0}`);
    this.logger.info('===========================');
  }
}

export default DataTaxonomyBuilder;