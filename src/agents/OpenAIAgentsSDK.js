// Import required dependencies from OpenAI Agents SDK and local ResponsesAPI
import { Agent, run, setDefaultOpenAIKey } from '@openai/agents';
import { ResponsesAPI } from '../api/ResponsesAPI.js';

// Main class for handling OpenAI Agents functionality
export class OpenAIAgentsSDK {
    constructor() {
        // Initialize maps to store default and custom agents
        this.agents = new Map();
        this.customAgents = new Map();
        // Create instance of ResponsesAPI for fallback functionality
        this.responsesAPI = new ResponsesAPI();
        // Flag to track if fallback mode is enabled
        this.useFallback = false;
        // Initialize OpenAI configuration and default agents
        this.initializeOpenAI();
        this.initializeDefaultAgents();
    }

    // Configure OpenAI API key from environment variables
    initializeOpenAI() {
        // Set the OpenAI API key for the agents SDK
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
            console.warn('Please create a .env file with your OpenAI API key');
            return;
        }
        
        try {
            setDefaultOpenAIKey(apiKey);
            console.log('✅ OpenAI API key configured for Agents SDK');
        } catch (error) {
            console.error('❌ Failed to set OpenAI API key:', error.message);
        }
    }

    // Set up default agents for history, math and triage functionality
    initializeDefaultAgents() {
        // Start with simple agents without tools to test basic functionality
        
        // History Tutor Agent (no tools for now)
        const historyTutorAgent = new Agent({
            name: 'History Tutor',
            instructions: 'You provide assistance with historical queries. Explain important events and context clearly. You have access to a wealth of historical knowledge and can provide interesting historical facts.'
        });

        // Math Tutor Agent (no tools for now)
        const mathTutorAgent = new Agent({
            name: 'Math Tutor',
            instructions: 'You provide help with math problems. Explain your reasoning at each step and include examples. You can perform calculations and help solve mathematical problems.'
        });

        // Triage Agent with handoffs to specialized tutors
        const triageAgent = new Agent({
            name: 'Triage Agent',
            instructions: 'You determine which agent to use based on the user\'s question. Route history questions to the History Tutor and math questions to the Math Tutor. For general questions, provide a direct response.',
            handoffs: [historyTutorAgent, mathTutorAgent]
        });

        // Store agents in the map for later use
        this.agents.set('history', historyTutorAgent);
        this.agents.set('math', mathTutorAgent);
        this.agents.set('triage', triageAgent);

        console.log('✅ OpenAI Agents SDK initialized with default agents (simplified version)');
    }

    // Main method to run an agent with given input
    async runAgent(agentType, input) {
        try {
            // Check if fallback mode is enabled
            if (this.useFallback) {
                return await this.runFallbackAgent(agentType, input);
            }

            let agent;
            
            // Handle custom vs predefined agents
            if (agentType.startsWith('custom-')) {
                // Handle custom agents
                const customIndex = parseInt(agentType.split('-')[1]);
                const customAgentsList = Array.from(this.customAgents.values());
                agent = customAgentsList[customIndex];
                
                if (!agent) {
                    throw new Error('Custom agent not found');
                }
            } else {
                // Handle predefined agents
                agent = this.agents.get(agentType);
                
                if (!agent) {
                    throw new Error(`Agent type '${agentType}' not found`);
                }
            }

            console.log(`🚀 Running ${agent.name} with input: "${input}"`);
            
            // Execute the agent with provided input
            const result = await run(agent, input);
            
            console.log(`✅ Agent completed. Final output from: ${result.finalAgent || 'Unknown'}`);
            
            // Return structured response with results
            return {
                success: true,
                output: result.finalOutput,
                finalAgent: result.finalAgent,
                handoffs: this.extractHandoffs(result),
                toolsUsed: this.extractToolsUsed(result)
            };
            
        } catch (error) {
            console.error('❌ Error running agent with official SDK:', error.message);
            console.log('🔄 Falling back to custom implementation...');
            
            // Enable fallback mode for future requests
            this.useFallback = true;
            
            // Try with fallback implementation
            return await this.runFallbackAgent(agentType, input);
        }
    }

    // Fallback implementation when OpenAI Agents SDK fails
    async runFallbackAgent(agentType, input) {
        try {
            console.log(`🔄 Running fallback agent: ${agentType} with input: "${input}"`);
            
            let systemPrompt = '';
            let agentName = '';
            
            // Configure agent behavior based on type
            switch (agentType) {
                case 'history':
                    agentName = 'History Tutor';
                    systemPrompt = 'You are an expert History Tutor. Provide detailed, accurate information about historical events, dates, people, and context. Explain things clearly and include interesting historical facts when relevant.';
                    break;
                    
                case 'math':
                    agentName = 'Math Tutor';
                    systemPrompt = 'You are an expert Math Tutor. Help solve math problems step by step. Show your work clearly, explain your reasoning, and provide examples when helpful. You can handle algebra, geometry, calculus, and other mathematical topics.';
                    break;
                    
                case 'triage':
                    agentName = 'Triage Agent';
                    // Use regex to determine question type
                    const isHistoryQuestion = /\b(history|historical|when|where|who|date|year|century|war|empire|civilization|ancient|medieval|renaissance|revolution|battle|king|queen|president|capital|country|nation)\b/i.test(input);
                    const isMathQuestion = /\b(solve|calculate|equation|math|algebra|geometry|trigonometry|calculus|\+|\-|\*|\/|=|x|y|formula|theorem|proof|derivative|integral|matrix|vector)\b/i.test(input);
                    
                    // Route to appropriate specialist based on question type
                    if (isHistoryQuestion && !isMathQuestion) {
                        agentName = 'History Tutor (via Triage)';
                        systemPrompt = 'You are a History Tutor. The Triage Agent has routed this history question to you. Provide detailed, accurate information about historical events, dates, people, and context.';
                    } else if (isMathQuestion && !isHistoryQuestion) {
                        agentName = 'Math Tutor (via Triage)';
                        systemPrompt = 'You are a Math Tutor. The Triage Agent has routed this math question to you. Help solve the problem step by step, show your work clearly, and explain your reasoning.';
                    } else {
                        agentName = 'General Assistant (via Triage)';
                        systemPrompt = 'You are a helpful general assistant. The Triage Agent determined this question doesn\'t clearly fit history or math categories, so provide a helpful general response. If the question seems to relate to history or math, mention that and provide appropriate guidance.';
                    }
                    break;
                    
                default:
                    agentName = 'Custom Agent';
                    systemPrompt = 'You are a helpful AI assistant. Provide accurate, detailed responses to user questions.';
            }
            
            // Use ResponsesAPI to generate response
            const response = await this.responsesAPI.chat({
                message: input,
                systemPrompt: systemPrompt,
                model: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
                temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
                max_tokens: parseInt(process.env.MAX_TOKENS) || 1000
            });
            
            // Return structured response if successful
            if (response.success && response.response) {
                console.log(`✅ Fallback agent completed: ${agentName}`);
                return {
                    success: true,
                    output: response.response,
                    finalAgent: agentName,
                    handoffs: agentType === 'triage' ? [agentName] : [],
                    toolsUsed: []
                };
            } else {
                throw new Error('Failed to get response from fallback implementation');
            }
            
        } catch (error) {
            console.error('❌ Error in fallback agent:', error);
            return {
                success: false,
                error: `Fallback agent failed: ${error.message}`
            };
        }
    }

    // Create a new custom agent with specified parameters
    async createCustomAgent(name, instructions, model = 'gpt-3.5-turbo') {
        try {
            const customAgent = new Agent({
                name: name,
                instructions: instructions,
                model: model
            });

            // Generate unique ID and store agent
            const agentId = `custom-${Date.now()}`;
            this.customAgents.set(agentId, customAgent);

            console.log(`✅ Created custom agent: ${name}`);
            
            return {
                success: true,
                agent: {
                    id: agentId,
                    name: name,
                    instructions: instructions,
                    model: model
                }
            };
        } catch (error) {
            console.error('❌ Error creating custom agent:', error);
            return {
                success: false,
                error: error.message || 'Failed to create custom agent'
            };
        }
    }

    // Get list of all available agents (both predefined and custom)
    getAvailableAgents() {
        const predefinedAgents = Array.from(this.agents.entries()).map(([key, agent]) => ({
            id: key,
            name: agent.name,
            type: 'predefined'
        }));

        const customAgents = Array.from(this.customAgents.entries()).map(([key, agent]) => ({
            id: key,
            name: agent.name,
            type: 'custom'
        }));

        return [...predefinedAgents, ...customAgents];
    }

    // Helper method to extract handoff information from result
    extractHandoffs(result) {
        // Extract handoff information from the result
        // This is a simplified implementation - the actual structure may vary
        return result.handoffs || [];
    }

    // Helper method to extract tools used from result
    extractToolsUsed(result) {
        // Extract tools used information from the result
        // This is a simplified implementation - the actual structure may vary
        return result.toolsUsed || [];
    }

    // Test method to verify agent functionality
    async testAgents() {
        console.log('🧪 Testing OpenAI Agents SDK...');
        
        try {
            // Test triage agent with sample questions
            const historyResult = await this.runAgent('triage', 'What is the capital of France?');
            console.log('History test result:', historyResult);
            
            const mathResult = await this.runAgent('triage', 'What is 2 + 2?');
            console.log('Math test result:', mathResult);
            
            return {
                success: true,
                results: { historyResult, mathResult }
            };
        } catch (error) {
            console.error('❌ Test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
} 