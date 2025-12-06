/**
 * Agent Orchestrator - Central coordination system for all agents
 * Manages agent lifecycle, communication, and request routing
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger.js';

export class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.activeRequests = new Map();
    this.logger = new Logger('AgentOrchestrator');
    this.metrics = {
      requestsProcessed: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Register a new agent with the orchestrator
   * @param {string} agentType - Type of agent (query, data, analysis, learning)
   * @param {Object} agentInstance - Instance of the agent
   */
  registerAgent(agentType, agentInstance) {
    if (this.agents.has(agentType)) {
      this.logger.warn(`Agent ${agentType} already registered, replacing`);
    }

    this.agents.set(agentType, agentInstance);
    this.logger.info(`Agent ${agentType} registered successfully`);

    // Set up agent event listeners
    agentInstance.on('error', (error) => {
      this.logger.error(`Agent ${agentType} error:`, error);
      this.emit('agent-error', { agentType, error });
    });

    agentInstance.on('status', (status) => {
      this.emit('agent-status', { agentType, status });
    });
  }

  /**
   * Process a user request by routing to appropriate agents
   * @param {Object} request - User request object
   * @returns {Promise<Object>} Response object
   */
  async processRequest(request) {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info(`Processing request ${requestId}:`, request.query);
      this.metrics.requestsProcessed++;

      // Store active request
      this.activeRequests.set(requestId, {
        ...request,
        requestId,
        startTime,
        status: 'processing'
      });

      // Determine intent and required agents
      const intent = await this.analyzeIntent(request);
      const requiredAgents = this.determineRequiredAgents(intent);

      this.logger.debug(`Intent: ${intent.type}, Required agents: ${requiredAgents.join(', ')}`);

      // Create execution plan
      const executionPlan = this.createExecutionPlan(intent, requiredAgents);

      // Execute plan
      const result = await this.executePlan(executionPlan, request);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      // Clean up
      this.activeRequests.delete(requestId);

      this.logger.info(`Request ${requestId} completed in ${responseTime}ms`);

      return {
        requestId,
        success: true,
        result,
        responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Request ${requestId} failed:`, error);
      this.updateMetrics(false, Date.now() - startTime);
      this.activeRequests.delete(requestId);

      return {
        requestId,
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze user intent to determine what type of request this is
   * @param {Object} request - User request
   * @returns {Promise<Object>} Intent analysis
   */
  async analyzeIntent(request) {
    // Basic intent analysis - will be enhanced with NLP
    const query = request.query.toLowerCase();

    if (query.includes('count') || query.includes('how many')) {
      return { type: 'aggregation', operation: 'count' };
    }

    if (query.includes('list') || query.includes('show') || query.includes('find')) {
      return { type: 'search', operation: 'find' };
    }

    if (query.includes('compare') || query.includes('versus') || query.includes('vs')) {
      return { type: 'comparison', operation: 'compare' };
    }

    if (query.includes('trend') || query.includes('over time') || query.includes('change')) {
      return { type: 'analysis', operation: 'trend' };
    }

    // Default to search if intent unclear
    return { type: 'search', operation: 'find' };
  }

  /**
   * Determine which agents are needed for this intent
   * @param {Object} intent - Intent analysis
   * @returns {Array<string>} List of required agent types
   */
  determineRequiredAgents(intent) {
    const agentMap = {
      'search': ['query'],
      'aggregation': ['query'],
      'comparison': ['query', 'analysis'],
      'analysis': ['query', 'analysis'],
      'integration': ['data'],
      'learning': ['learning']
    };

    return agentMap[intent.type] || ['query'];
  }

  /**
   * Create execution plan for the request
   * @param {Object} intent - Intent analysis
   * @param {Array<string>} requiredAgents - Required agents
   * @returns {Object} Execution plan
   */
  createExecutionPlan(intent, requiredAgents) {
    return {
      intent,
      agents: requiredAgents,
      steps: this.generateExecutionSteps(intent, requiredAgents),
      parallel: this.canRunInParallel(intent),
      timeout: this.calculateTimeout(intent)
    };
  }

  /**
   * Generate execution steps based on intent and agents
   * @param {Object} intent - Intent analysis
   * @param {Array<string>} requiredAgents - Required agents
   * @returns {Array<Object>} Execution steps
   */
  generateExecutionSteps(intent, requiredAgents) {
    const steps = [];

    // Map intent types to agent actions
    const intentToAction = {
      'search': 'search',
      'aggregation': 'count',
      'comparison': 'search',
      'analysis': 'search'
    };

    // For most queries, start with the query agent
    if (requiredAgents.includes('query')) {
      const action = intentToAction[intent.type] || 'search';
      steps.push({
        agent: 'query',
        action: action,
        dependencies: []
      });
    }

    // Add analysis if needed
    if (requiredAgents.includes('analysis')) {
      steps.push({
        agent: 'analysis',
        action: 'analyze',
        dependencies: ['query']
      });
    }

    return steps;
  }

  /**
   * Execute the planned steps
   * @param {Object} plan - Execution plan
   * @param {Object} request - Original request
   * @returns {Promise<Object>} Execution result
   */
  async executePlan(plan, request) {
    const results = {};
    const context = { request, results };

    for (const step of plan.steps) {
      const agent = this.agents.get(step.agent);
      if (!agent) {
        throw new Error(`Agent ${step.agent} not found`);
      }

      this.logger.debug(`Executing step: ${step.agent}.${step.action}`);

      try {
        const stepResult = await agent.execute(step.action, context);
        results[step.agent] = stepResult;
        context.results = results;
      } catch (error) {
        this.logger.error(`Step ${step.agent}.${step.action} failed:`, error);
        throw error;
      }
    }

    return this.synthesizeResults(results, plan.intent);
  }

  /**
   * Synthesize results from multiple agents into final response
   * @param {Object} results - Results from agents
   * @param {Object} intent - Original intent
   * @returns {Object} Synthesized response
   */
  synthesizeResults(results, intent) {
    // Primary result comes from query agent
    let response = results.query || {};

    // Enhance with analysis if available
    if (results.analysis) {
      response.insights = results.analysis.insights;
      response.patterns = results.analysis.patterns;
    }

    // Add metadata
    response.intent = intent;
    response.confidence = this.calculateConfidence(results);

    return response;
  }

  /**
   * Calculate confidence score for the response
   * @param {Object} results - Results from agents
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(results) {
    let totalConfidence = 0;
    let agentCount = 0;

    for (const [agentType, result] of Object.entries(results)) {
      if (result.confidence !== undefined) {
        totalConfidence += result.confidence;
        agentCount++;
      }
    }

    return agentCount > 0 ? totalConfidence / agentCount : 0.5;
  }

  /**
   * Check if agents can run in parallel
   * @param {Object} intent - Intent analysis
   * @returns {boolean} Can run in parallel
   */
  canRunInParallel(intent) {
    // For now, run sequentially to maintain context
    return false;
  }

  /**
   * Calculate timeout for request
   * @param {Object} intent - Intent analysis
   * @returns {number} Timeout in milliseconds
   */
  calculateTimeout(intent) {
    const timeouts = {
      'search': 10000,
      'aggregation': 15000,
      'comparison': 20000,
      'analysis': 30000
    };

    return timeouts[intent.type] || 15000;
  }

  /**
   * Update performance metrics
   * @param {boolean} success - Whether request was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  updateMetrics(success, responseTime) {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Get system health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const activeAgents = Array.from(this.agents.keys());
    const activeRequestCount = this.activeRequests.size;

    return {
      status: 'healthy',
      agents: {
        registered: activeAgents,
        count: activeAgents.length
      },
      requests: {
        active: activeRequestCount,
        total: this.metrics.requestsProcessed
      },
      performance: {
        successRate: this.metrics.requestsProcessed > 0
          ? this.metrics.successfulRequests / this.metrics.requestsProcessed
          : 0,
        averageResponseTime: this.metrics.averageResponseTime
      },
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown orchestrator gracefully
   */
  async shutdown() {
    this.logger.info('Shutting down agent orchestrator...');

    // Wait for active requests to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Shutdown all agents
    for (const [agentType, agent] of this.agents) {
      try {
        if (typeof agent.shutdown === 'function') {
          await agent.shutdown();
        }
      } catch (error) {
        this.logger.error(`Error shutting down agent ${agentType}:`, error);
      }
    }

    this.logger.info('Agent orchestrator shutdown complete');
  }
}

export default AgentOrchestrator;