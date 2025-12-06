/**
 * Response Formatter - Converts query results into human-readable responses
 * Provides natural language answers for chat interactions
 */

export class ResponseFormatter {
  /**
   * Format the response based on query type and results
   * @param {Object} result - Query result object
   * @returns {string} Human-readable response
   */
  static formatResponse(result) {
    if (!result || !result.success) {
      return "I'm sorry, I couldn't process your query. Please try rephrasing your question.";
    }

    // Handle nested result structure from orchestrator
    // Actual structure: result.result.result contains the query data
    const queryResult = result.result?.result;
    const intent = queryResult?.intent?.primary || 'search';

    // Remove debug logging

    switch (intent) {
      case 'count':
        return this.formatCountResponse(queryResult);

      case 'search':
        return this.formatSearchResponse(queryResult);

      case 'aggregate':
        return this.formatAggregateResponse(queryResult);

      case 'compare':
        return this.formatCompareResponse(queryResult);

      case 'analyze':
        return this.formatAnalyzeResponse(queryResult);

      default:
        return this.formatDefaultResponse(queryResult);
    }
  }

  /**
   * Format count query responses
   */
  static formatCountResponse(result) {
    const { counts, totalCount, query } = result;
    const actualQuery = query || 'your request';

    if (!counts || counts.length === 0) {
      return `I couldn't find any data matching your query: "${actualQuery}". Please check if the terms are correct or try a different search.`;
    }

    // Handle performance counting queries
    if (actualQuery && actualQuery.toLowerCase().includes('over performed')) {
      return `Based on the data analysis, **${totalCount} weeks** were classified as "Over Performed".`;
    }

    if (actualQuery && (actualQuery.toLowerCase().includes('under performed') || actualQuery.toLowerCase().includes('underperformed'))) {
      return `Based on the data analysis, **${totalCount} weeks** were classified as "Under Performed".`;
    }

    if (actualQuery && actualQuery.toLowerCase().includes('average performance')) {
      return `Based on the data analysis, **${totalCount} weeks** had "Average Performance".`;
    }

    // General count response
    const metric = counts[0].metric;
    return `I found **${totalCount} ${metric.toLowerCase()}** matching your criteria.`;
  }

  /**
   * Format search query responses
   */
  static formatSearchResponse(result) {
    const { results, query, searchedIn } = result;
    const actualQuery = query || 'your query';

    if (!results || results.length === 0) {
      return `I couldn't find any data matching: "${actualQuery}". Try using different keywords or checking the spelling.`;
    }

    // Handle new taxonomy-driven search results structure
    // Results is an array of objects with source/sheet/matches
    let allMatches = [];
    let totalMatches = 0;

    if (Array.isArray(results)) {
      results.forEach(result => {
        if (result.matches && Array.isArray(result.matches)) {
          allMatches = allMatches.concat(result.matches);
          totalMatches += result.matches.length;
        }
      });
    }

    if (allMatches.length === 0) {
      return `I couldn't find any data matching: "${actualQuery}". Try using different keywords or checking the spelling.`;
    }

    const matches = allMatches;

    // Handle Aetna-specific queries
    if (actualQuery.toLowerCase().includes('aetna')) {
      if (actualQuery.toLowerCase().includes('operational')) {
        return this.formatAetnaOperationalResponse(matches);
      }

      // General Aetna search
      return `I found **${totalMatches} records** mentioning Aetna${searchedIn !== 'all columns' ? ` in the "${searchedIn}" column` : ''}.\n\n` +
        `Here are some key highlights:\n` +
        matches.slice(0, 3).map((match, i) =>
          `${i + 1}. **Week ${match.Week}**: ${this.extractAetnaInfo(match)}`
        ).join('\n');
    }

    // Handle other insurance company queries
    const insuranceCompanies = ['bcbs', 'cigna', 'humana', 'medicare', 'medicaid', 'tricare'];
    const mentionedCompany = insuranceCompanies.find(company =>
      actualQuery.toLowerCase().includes(company)
    );

    if (mentionedCompany) {
      return `I found **${totalMatches} records** mentioning ${mentionedCompany.toUpperCase()}${searchedIn !== 'all columns' ? ` in the "${searchedIn}" column` : ''}.\n\n` +
        `Here are the first few examples:\n` +
        matches.slice(0, 3).map((match, i) =>
          `${i + 1}. **Week ${match.Week}**: Performance was "${match['Performance Diagnostic']}"`
        ).join('\n');
    }

    // General search response
    return `I found **${totalMatches} matching records**${searchedIn !== 'all columns' ? ` in the "${searchedIn}" column` : ''}.\n\n` +
      `Sample results from the data:\n` +
      matches.slice(0, 3).map((match, i) =>
        `${i + 1}. **Week ${match.Week}**: ${match['Performance Diagnostic'] || 'Data available'}`
      ).join('\n');
  }

  /**
   * Format Aetna operational response specifically
   */
  static formatAetnaOperationalResponse(matches) {
    const aetnaScenarios = [];

    matches.forEach(match => {
      const week = match.Week;
      const operational = match['Operational - What Went Well'] || '';

      // Extract Aetna-specific improvements
      const aetnaItems = operational
        .split(';')
        .filter(item => item.includes('AETNA'))
        .map(item => item.trim());

      if (aetnaItems.length > 0) {
        aetnaScenarios.push({ week, improvements: aetnaItems });
      }
    });

    if (aetnaScenarios.length === 0) {
      return `No specific Aetna scenarios were found in the "Operational - What Went Well" column.`;
    }

    let response = `I found **${aetnaScenarios.length} weeks** where Aetna (17-AETNA) showed operational improvements:\n\n`;

    aetnaScenarios.forEach(scenario => {
      response += `**Week ${scenario.week}:**\n`;
      scenario.improvements.forEach(improvement => {
        const parts = improvement.split('–');
        if (parts.length > 1) {
          response += `• ${parts[1].trim()}\n`;
        }
      });
      response += '\n';
    });

    // Add summary
    const commonImprovement = this.findCommonPattern(aetnaScenarios);
    if (commonImprovement) {
      response += `**Key Pattern:** ${commonImprovement}`;
    }

    return response;
  }

  /**
   * Extract Aetna-specific information from a record
   */
  static extractAetnaInfo(match) {
    // Check different columns for Aetna mentions
    const columns = [
      'Operational - What Went Well',
      'Operational - What Can Be Improved',
      'Revenue Cycle - What Went Well',
      'Revenue Cycle - What Can Be Improved',
      'Zero-Balance Collection Narrative'
    ];

    for (const col of columns) {
      if (match[col] && match[col].includes('AETNA')) {
        const aetnaItems = match[col]
          .split(';')
          .find(item => item.includes('AETNA'));

        if (aetnaItems) {
          return aetnaItems.trim().replace('17-AETNA –', 'Aetna:');
        }
      }
    }

    return `Performance: ${match['Performance Diagnostic']}`;
  }

  /**
   * Find common patterns in improvements
   */
  static findCommonPattern(scenarios) {
    const patterns = {};

    scenarios.forEach(scenario => {
      scenario.improvements.forEach(improvement => {
        if (improvement.includes('Procedure per Visit')) {
          patterns['Procedure per Visit improvements'] = (patterns['Procedure per Visit improvements'] || 0) + 1;
        }
        if (improvement.includes('Visit Count')) {
          patterns['Visit Count increases'] = (patterns['Visit Count increases'] || 0) + 1;
        }
        if (improvement.includes('Radiology')) {
          patterns['Radiology utilization improvements'] = (patterns['Radiology utilization improvements'] || 0) + 1;
        }
      });
    });

    const topPattern = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])[0];

    if (topPattern) {
      return `Most common improvement was ${topPattern[0]} (${topPattern[1]} occurrences)`;
    }

    return null;
  }

  /**
   * Format aggregate query responses
   */
  static formatAggregateResponse(result) {
    const { results, query } = result;
    const actualQuery = query || 'your query';

    if (!results || results.length === 0) {
      return `No aggregation data available for: "${actualQuery}"`;
    }

    const aggregations = results[0].aggregations;
    const firstMetric = Object.keys(aggregations)[0];

    if (firstMetric) {
      const stats = aggregations[firstMetric];
      return `For ${firstMetric}:\n` +
        `• Average: ${stats.average.toFixed(2)}\n` +
        `• Total: ${stats.sum.toFixed(2)}\n` +
        `• Range: ${stats.min.toFixed(2)} to ${stats.max.toFixed(2)}\n` +
        `• Count: ${stats.count} records`;
    }

    return `Aggregation completed with ${Object.keys(aggregations).length} metrics analyzed.`;
  }

  /**
   * Format comparison query responses
   */
  static formatCompareResponse(result) {
    return `Comparison analysis: ${result.results?.length || 0} data sets compared.`;
  }

  /**
   * Format analysis query responses
   */
  static formatAnalyzeResponse(result) {
    const { results } = result;

    if (!results || results.length === 0) {
      return `No analysis results available for your query.`;
    }

    return `Analysis complete. Found ${results[0].totalMatches} relevant data points for evaluation.`;
  }

  /**
   * Format default response
   */
  static formatDefaultResponse(result) {
    const { query, results } = result;
    const actualQuery = query || 'your query';

    if (results && results.length > 0) {
      return `Processed your query: "${actualQuery}". Found ${results[0].totalMatches || 'relevant'} results.`;
    }

    return `Query processed successfully. Please be more specific if you need detailed information.`;
  }
}

export default ResponseFormatter;