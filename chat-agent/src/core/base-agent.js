/**
 * Base Agent Class
 * Provides common functionality for all specialized agents
 */

import { EventEmitter } from 'events';
import { Logger } from './logger.js';

export class BaseAgent extends EventEmitter {
  constructor(agentType, capabilities = []) {
    super();
    this.agentType = agentType;
    this.capabilities = capabilities;
    this.logger = new Logger(agentType);
    this.status = 'initializing';
    this.metrics = {
      tasksProcessed: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0
    };

    this.initialize();
  }

  /**
   * Initialize the agent - override in subclasses
   */
  async initialize() {
    this.status = 'ready';
    this.logger.info(`${this.agentType} agent initialized with capabilities: ${this.capabilities.join(', ')}`);
    this.emit('status', { status: this.status, capabilities: this.capabilities });
  }

  /**
   * Main execution method - must be implemented by subclasses
   * @param {string} action - Action to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(action, context) {
    if (this.status !== 'ready') {
      throw new Error(`Agent ${this.agentType} is not ready (status: ${this.status})`);
    }

    const startTime = Date.now();
    this.status = 'processing';
    this.emit('status', { status: this.status });

    try {
      this.logger.debug(`Executing action: ${action}`);
      this.metrics.tasksProcessed++;

      const result = await this.performAction(action, context);

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      this.status = 'ready';

      this.logger.debug(`Action ${action} completed in ${processingTime}ms`);
      this.emit('status', { status: this.status });

      return {
        success: true,
        result,
        processingTime,
        confidence: this.calculateConfidence(result, context),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      this.status = 'ready';

      this.logger.error(`Action ${action} failed:`, error);
      this.emit('error', error);
      this.emit('status', { status: this.status });

      throw error;
    }
  }

  /**
   * Perform the actual action - must be implemented by subclasses
   * @param {string} action - Action to perform
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Action result
   */
  async performAction(action, context) {
    throw new Error(`performAction must be implemented by ${this.agentType} agent`);
  }

  /**
   * Calculate confidence score for the result
   * @param {Object} result - Action result
   * @param {Object} context - Execution context
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(result, context) {
    // Default implementation - override in subclasses for specific logic
    if (!result || Object.keys(result).length === 0) {
      return 0.1;
    }

    // Base confidence based on result completeness
    let confidence = 0.5;

    // Increase confidence if we have data
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      confidence += 0.3;
    }

    // Increase confidence if we have metadata
    if (result.metadata) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Update agent performance metrics
   * @param {boolean} success - Whether the task was successful
   * @param {number} processingTime - Processing time in milliseconds
   */
  updateMetrics(success, processingTime) {
    if (success) {
      this.metrics.successfulTasks++;
    } else {
      this.metrics.failedTasks++;
    }

    // Update average processing time
    const totalTasks = this.metrics.successfulTasks + this.metrics.failedTasks;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalTasks - 1) + processingTime) / totalTasks;
  }

  /**
   * Check if agent can handle a specific action
   * @param {string} action - Action to check
   * @returns {boolean} Can handle action
   */
  canHandle(action) {
    return this.capabilities.includes(action);
  }

  /**
   * Get agent status and metrics
   * @returns {Object} Agent status
   */
  getStatus() {
    return {
      agentType: this.agentType,
      status: this.status,
      capabilities: this.capabilities,
      metrics: {
        ...this.metrics,
        successRate: this.metrics.tasksProcessed > 0
          ? this.metrics.successfulTasks / this.metrics.tasksProcessed
          : 0
      }
    };
  }

  /**
   * Validate input parameters
   * @param {Object} params - Parameters to validate
   * @param {Array<string>} required - Required parameter names
   * @throws {Error} If validation fails
   */
  validateParams(params, required = []) {
    for (const param of required) {
      if (!(param in params) || params[param] === undefined || params[param] === null) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  /**
   * Create a standardized error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} details - Additional error details
   * @returns {Object} Error response
   */
  createError(message, code = 'AGENT_ERROR', details = {}) {
    return {
      success: false,
      error: {
        message,
        code,
        agentType: this.agentType,
        details,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown() {
    this.status = 'shutting_down';
    this.logger.info(`${this.agentType} agent shutting down...`);

    // Perform any cleanup tasks here
    await this.cleanup();

    this.status = 'shutdown';
    this.logger.info(`${this.agentType} agent shutdown complete`);
  }

  /**
   * Cleanup method - override in subclasses if needed
   */
  async cleanup() {
    // Default implementation does nothing
    // Override in subclasses for specific cleanup
  }
}

export default BaseAgent;