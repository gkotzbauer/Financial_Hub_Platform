/**
 * Main application entry point for Financial Hub Chat Agent
 * Independent agentic system for financial data analysis
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { Logger } from './core/logger.js';
import { AgentOrchestrator } from './core/agent-orchestrator.js';
import { QueryAgent } from './agents/query-agent.js';
import { ResponseFormatter } from './utils/response-formatter.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ChatAgentApplication {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3010;
    this.logger = new Logger('ChatAgent');
    this.orchestrator = new AgentOrchestrator();
    this.server = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      this.logger.info('Initializing Financial Hub Chat Agent...');

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Initialize orchestrator and agents
      await this.setupAgents();

      // Setup error handling
      this.setupErrorHandling();

      this.logger.info('Application initialization complete');

    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : true,
      credentials: true
    }));

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => this.logger.info(message.trim())
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files for UI (if needed)
    this.app.use('/public', express.static(join(__dirname, '..', 'public')));
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const health = this.orchestrator.getHealthStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        ...health
      });
    });

    // Main chat endpoint
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { query, context = {} } = req.body;

        if (!query) {
          return res.status(400).json({
            error: 'Query is required',
            code: 'MISSING_QUERY'
          });
        }

        this.logger.info(`Received chat request: ${query}`);

        const response = await this.orchestrator.processRequest({
          query,
          context,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // Format the response for human readability
        const formattedAnswer = ResponseFormatter.formatResponse(response);

        res.json({
          ...response,
          answer: formattedAnswer
        });

      } catch (error) {
        this.logger.error('Chat request failed:', error);

        res.status(500).json({
          error: 'Internal server error',
          code: 'PROCESSING_ERROR',
          message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // Data sources information endpoint
    this.app.get('/api/data-sources', async (req, res) => {
      try {
        const queryAgent = this.orchestrator.agents.get('query');
        if (!queryAgent) {
          return res.status(503).json({
            error: 'Query agent not available',
            code: 'SERVICE_UNAVAILABLE'
          });
        }

        const info = queryAgent.getDataSourcesInfo();
        res.json(info);

      } catch (error) {
        this.logger.error('Failed to get data sources info:', error);
        res.status(500).json({
          error: 'Failed to retrieve data sources',
          code: 'DATA_SOURCE_ERROR'
        });
      }
    });

    // Agent status endpoint
    this.app.get('/api/agents/status', (req, res) => {
      const agents = Array.from(this.orchestrator.agents.entries()).map(([type, agent]) => ({
        type,
        status: agent.getStatus()
      }));

      res.json({
        agents,
        orchestrator: this.orchestrator.getHealthStatus()
      });
    });

    // Suggestions endpoint
    this.app.get('/api/suggestions', async (req, res) => {
      try {
        const { query } = req.query;

        if (!query || query.length < 2) {
          return res.json({ suggestions: [] });
        }

        const queryAgent = this.orchestrator.agents.get('query');
        if (!queryAgent) {
          return res.json({ suggestions: [] });
        }

        const suggestions = queryAgent.nlpEngine.getSuggestions(query);
        res.json({ suggestions });

      } catch (error) {
        this.logger.error('Failed to get suggestions:', error);
        res.json({ suggestions: [] });
      }
    });

    // Basic UI endpoint (for development/testing)
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Financial Hub Chat Agent</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .chat-container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
            input, button { padding: 10px; margin: 5px; }
            input[type="text"] { width: 70%; }
            button { background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .response { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0; }
            .error { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <h1>Financial Hub Chat Agent</h1>
          <div class="chat-container">
            <h3>Ask a question about your financial data:</h3>
            <div>
              <input type="text" id="queryInput" placeholder="e.g., list all scenarios with Aetna" />
              <button onclick="sendQuery()">Send</button>
            </div>
            <div id="response"></div>
          </div>

          <script>
            async function sendQuery() {
              const query = document.getElementById('queryInput').value;
              if (!query) return;

              const responseDiv = document.getElementById('response');
              responseDiv.innerHTML = '<div>Processing...</div>';

              try {
                const response = await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query })
                });

                const data = await response.json();

                if (data.success) {
                  responseDiv.innerHTML = '<div class="response">' +
                    '<div style="white-space: pre-wrap; line-height: 1.5;">' +
                    (data.answer || 'Response received successfully') +
                    '</div></div>';
                } else {
                  responseDiv.innerHTML = '<div class="response error">Error: ' + (data.error || 'Unknown error') + '</div>';
                }
              } catch (error) {
                responseDiv.innerHTML = '<div class="response error">Network error: ' + error.message + '</div>';
              }
            }

            document.getElementById('queryInput').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                sendQuery();
              }
            });
          </script>
        </body>
        </html>
      `);
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
      });
    });
  }

  /**
   * Setup agents and orchestrator
   */
  async setupAgents() {
    this.logger.info('Setting up agents...');

    // Create and register query agent
    const queryAgent = new QueryAgent();
    await queryAgent.initialize();
    this.orchestrator.registerAgent('query', queryAgent);

    this.logger.info('Agents setup complete');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error:', error);

      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: req.headers['x-request-id']
      });
    });

    // Process error handlers
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Financial Hub Chat Agent listening on port ${this.port}`);
        this.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.logger.info(`Health check: http://localhost:${this.port}/health`);
        this.logger.info(`Chat interface: http://localhost:${this.port}/`);
      });

      return this.server;

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    this.logger.info(`Received ${signal}, starting graceful shutdown...`);

    if (this.server) {
      this.server.close(() => {
        this.logger.info('HTTP server closed');
      });
    }

    try {
      await this.orchestrator.shutdown();
      this.logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get application instance (for testing)
   */
  getApp() {
    return this.app;
  }
}

// Start the application if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new ChatAgentApplication();
  app.start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { ChatAgentApplication };
export default ChatAgentApplication;