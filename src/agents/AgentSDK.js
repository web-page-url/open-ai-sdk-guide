import { v4 as uuidv4 } from 'uuid';
import { createChatCompletion, createFunctionCall } from '../config/openai.js';
import { WebSearchAgent } from './WebSearchAgent.js';
import { FileSearchAgent } from './FileSearchAgent.js';
import { ComputerUseAgent } from './ComputerUseAgent.js';

export class AgentSDK {
  constructor() {
    this.name = 'AgentSDK';
    this.description = 'SDK for building custom AI agents that can think, plan, use tools, and talk with other agents';
    this.agents = new Map();
    this.conversations = new Map();
    this.tools = this.initializeTools();
  }

  /**
   * Initialize available tools for agents
   */
  initializeTools() {
    return {
      web_search: new WebSearchAgent(),
      file_search: new FileSearchAgent(),
      computer_use: new ComputerUseAgent()
    };
  }

  /**
   * Create a new custom agent
   */
  async createAgent(config) {
    try {
      const {
        name,
        description,
        capabilities = [],
        systemPrompt,
        tools = [],
        personality = 'helpful',
        memory = true,
        max_tokens = 2000,
        temperature = 0.7
      } = config;

      if (!name) {
        throw new Error('Agent name is required');
      }

      const agentId = uuidv4();
      const agent = {
        id: agentId,
        name,
        description,
        capabilities,
        systemPrompt: systemPrompt || this.generateDefaultSystemPrompt(name, description, capabilities),
              tools,
      personality,
      memory,
      max_tokens,
      temperature,
        created: new Date().toISOString(),
        conversations: [],
        status: 'active'
      };

      this.agents.set(agentId, agent);

      console.log(`🤖 Created agent: ${name} (${agentId})`);

      return {
        success: true,
        agent: {
          id: agentId,
          name,
          description,
          capabilities,
          tools,
          created: agent.created
        }
      };
    } catch (error) {
      console.error('Agent creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a task with a specific agent
   */
  async executeAgent(agentId, task, context = {}) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      console.log(`🚀 Executing task with agent: ${agent.name}`);

      // Create conversation if it doesn't exist
      const conversationId = context.conversationId || uuidv4();
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, {
          id: conversationId,
          agentId,
          messages: [],
          created: new Date().toISOString()
        });
      }

      const conversation = this.conversations.get(conversationId);

      // Prepare the execution environment
      const executionResult = await this.processAgentTask(agent, task, conversation, context);

      // Update conversation history
      conversation.messages.push({
        role: 'user',
        content: task,
        timestamp: new Date().toISOString()
      });

      conversation.messages.push({
        role: 'assistant',
        content: executionResult.response,
        toolCalls: executionResult.toolCalls,
        timestamp: new Date().toISOString()
      });

      return executionResult;
    } catch (error) {
      console.error('Agent execution error:', error);
      return {
        success: false,
        error: error.message,
        agentId,
        task
      };
    }
  }

  /**
   * Process an agent task with thinking, planning, and tool usage
   */
  async processAgentTask(agent, task, conversation, context) {
    try {
      // Step 1: Analyze the task and determine required tools
      const analysis = await this.analyzeTask(agent, task, context);
      
      // Step 2: Plan the execution
      const plan = await this.createExecutionPlan(agent, task, analysis, context);
      
      // Step 3: Execute the plan
      const execution = await this.executePlan(agent, plan, context);
      
      // Step 4: Generate final response
      const response = await this.generateFinalResponse(agent, task, execution, context);

      return {
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        task,
        analysis,
        plan,
        execution,
        response,
        toolCalls: execution.toolCalls || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        agentId: agent.id,
        task
      };
    }
  }

  /**
   * Analyze the task to understand what needs to be done
   */
  async analyzeTask(agent, task, context) {
    try {
      const messages = [
        {
          role: 'system',
          content: `${agent.systemPrompt}\n\nYou are analyzing a task to determine what actions are needed. Available tools: ${agent.tools.join(', ')}`
        },
        {
          role: 'user',
          content: `Analyze this task and determine what tools or actions are needed: "${task}"\n\nContext: ${JSON.stringify(context)}\n\nRespond with a JSON object containing: { "taskType": "...", "requiredTools": [...], "complexity": "low/medium/high", "estimatedSteps": [...] }`
        }
      ];

      const response = await createChatCompletion(messages, {
        temperature: 0.3,
        max_tokens: 500
      });

      try {
        const analysis = JSON.parse(response.choices[0].message.content);
        return analysis;
      } catch {
        // Fallback if JSON parsing fails
        return {
          taskType: 'general',
          requiredTools: agent.tools,
          complexity: 'medium',
          estimatedSteps: ['Analyze task', 'Execute', 'Respond'],
          rawAnalysis: response.choices[0].message.content
        };
      }
    } catch (error) {
      return {
        taskType: 'unknown',
        requiredTools: [],
        complexity: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Create an execution plan based on task analysis
   */
  async createExecutionPlan(agent, task, analysis, context) {
    try {
      const messages = [
        {
          role: 'system',
          content: `${agent.systemPrompt}\n\nYou are creating an execution plan. Break down the task into clear, actionable steps.`
        },
        {
          role: 'user',
          content: `Create an execution plan for: "${task}"\n\nTask Analysis: ${JSON.stringify(analysis)}\n\nCreate a step-by-step plan with specific actions and tools to use.`
        }
      ];

      const response = await createChatCompletion(messages, {
        temperature: 0.3,
        max_tokens: 800
      });

      return {
        steps: response.choices[0].message.content,
        requiredTools: analysis.requiredTools || [],
        complexity: analysis.complexity || 'medium'
      };
    } catch (error) {
      return {
        steps: `1. Analyze the task: "${task}"\n2. Execute appropriate actions\n3. Provide results`,
        requiredTools: [],
        complexity: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Execute the planned steps
   */
  async executePlan(agent, plan, context) {
    try {
      const results = [];
      const toolCalls = [];

      // Check if any tools need to be called
      for (const toolName of plan.requiredTools) {
        if (this.tools[toolName]) {
          const toolResult = await this.executeTool(toolName, context);
          results.push(toolResult);
          toolCalls.push({
            tool: toolName,
            result: toolResult
          });
        }
      }

      return {
        results,
        toolCalls,
        status: 'completed'
      };
    } catch (error) {
      return {
        results: [],
        toolCalls: [],
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Execute a specific tool
   */
  async executeTool(toolName, context) {
    try {
      const tool = this.tools[toolName];
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      switch (toolName) {
        case 'web_search':
          if (context.query) {
            return await tool.search(context.query, context.maxResults || 5);
          }
          break;
        case 'file_search':
          if (context.filePath && context.query) {
            return await tool.searchInFile(context.filePath, context.query);
          }
          break;
        case 'computer_use':
          if (context.action || context.command) {
            return await tool.execute(context);
          }
          break;
      }

      throw new Error(`Tool ${toolName} requires additional context`);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: toolName
      };
    }
  }

  /**
   * Generate final response based on execution results
   */
  async generateFinalResponse(agent, task, execution, context) {
    try {
      const executionSummary = execution.results.map(result => 
        typeof result === 'object' ? JSON.stringify(result, null, 2) : result
      ).join('\n\n');

      const messages = [
        {
          role: 'system',
          content: `${agent.systemPrompt}\n\nYou are providing a final response based on the execution results. Be helpful, accurate, and concise.`
        },
        {
          role: 'user',
          content: `Task: "${task}"\n\nExecution Results:\n${executionSummary}\n\nProvide a comprehensive response to the user based on these results.`
        }
      ];

      const response = await createChatCompletion(messages, {
        temperature: agent.temperature,
        max_tokens: agent.max_tokens
      });

      return response.choices[0].message.content;
    } catch (error) {
      return `I completed the task "${task}" but encountered an error generating the response: ${error.message}`;
    }
  }

  /**
   * Generate default system prompt for an agent
   */
  generateDefaultSystemPrompt(name, description, capabilities) {
    return `You are ${name}, an AI agent. ${description || 'You are designed to be helpful and efficient.'}

Your capabilities include: ${capabilities.join(', ')}.

You should:
1. Think step by step about each task
2. Use available tools when appropriate
3. Provide clear, helpful responses
4. Be accurate and reliable
5. Ask for clarification when needed

Always maintain a professional and helpful demeanor while completing tasks efficiently.`;
  }

  /**
   * List all created agents
   */
  listAgents() {
    const agentList = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      tools: agent.tools,
      status: agent.status,
      created: agent.created,
      conversationCount: agent.conversations.length
    }));

    return {
      agents: agentList,
      total: agentList.length,
      availableTools: Object.keys(this.tools)
    };
  }

  /**
   * Get agent details by ID
   */
  getAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found'
      };
    }

    return {
      success: true,
      agent
    };
  }

  /**
   * Update an agent's configuration
   */
  updateAgent(agentId, updates) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Update allowed fields
      const allowedUpdates = ['description', 'capabilities', 'systemPrompt', 'tools', 'personality', 'max_tokens', 'temperature'];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          agent[key] = value;
        }
      }

      agent.updated = new Date().toISOString();
      this.agents.set(agentId, agent);

      return {
        success: true,
        agent: {
          id: agentId,
          updated: agent.updated
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete an agent
   */
  deleteAgent(agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      this.agents.delete(agentId);

      return {
        success: true,
        message: `Agent ${agent.name} deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enable agent-to-agent communication
   */
  async agentCommunication(fromAgentId, toAgentId, message, context = {}) {
    try {
      const fromAgent = this.agents.get(fromAgentId);
      const toAgent = this.agents.get(toAgentId);

      if (!fromAgent || !toAgent) {
        throw new Error('One or both agents not found');
      }

      console.log(`💬 Agent communication: ${fromAgent.name} → ${toAgent.name}`);

      // Execute the message with the target agent
      const response = await this.executeAgent(toAgentId, message, {
        ...context,
        fromAgent: fromAgent.name,
        communicationType: 'agent-to-agent'
      });

      return {
        success: true,
        from: fromAgent.name,
        to: toAgent.name,
        message,
        response: response.response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fromAgentId,
        toAgentId
      };
    }
  }

  /**
   * Get SDK status and information
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      agentCount: this.agents.size,
      conversationCount: this.conversations.size,
      availableTools: Object.keys(this.tools),
      features: [
        'Custom agent creation',
        'Task analysis and planning',
        'Tool integration',
        'Agent-to-agent communication',
        'Conversation management',
        'Memory and context handling'
      ]
    };
  }
} 