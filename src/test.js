import dotenv from 'dotenv';
import { AgentSDK } from './agents/AgentSDK.js';
import { WebSearchAgent } from './agents/WebSearchAgent.js';
import { FileSearchAgent } from './agents/FileSearchAgent.js';
import { ComputerUseAgent } from './agents/ComputerUseAgent.js';
import { ResponsesAPI } from './api/ResponsesAPI.js';

// Load environment variables
dotenv.config();

console.log('🧪 Starting AI Agents SDK Tests\n');

async function testResponsesAPI() {
  console.log('📡 Testing Responses API...');
  const responsesAPI = new ResponsesAPI();
  
  try {
    const result = await responsesAPI.chat({
      message: 'Hello! Can you explain what AI agents are in simple terms?'
    });
    
    if (result.success) {
      console.log('✅ Responses API test passed');
      console.log('📝 Response:', result.response.substring(0, 100) + '...\n');
    } else {
      console.log('❌ Responses API test failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Responses API test error:', error.message);
  }
}

async function testWebSearchAgent() {
  console.log('🔍 Testing Web Search Agent...');
  const webSearchAgent = new WebSearchAgent();
  
  try {
    const result = await webSearchAgent.search('latest AI developments 2024', 3);
    
    if (result.success) {
      console.log('✅ Web Search Agent test passed');
      console.log('📄 Found', result.results.length, 'results');
      console.log('🤖 AI Summary:', result.synthesis.answer.substring(0, 150) + '...\n');
    } else {
      console.log('❌ Web Search Agent test failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Web Search Agent test error:', error.message);
  }
}

async function testFileSearchAgent() {
  console.log('📂 Testing File Search Agent...');
  const fileSearchAgent = new FileSearchAgent();
  
  try {
    // Create a test file
    const fs = await import('fs-extra');
    const testFilePath = './test-document.txt';
    const testContent = `
    AI Agents SDK Documentation
    
    This document contains information about AI agents and their capabilities.
    
    Key Features:
    - Web search functionality for real-time information
    - File processing for PDFs, Word documents, and Excel files
    - Computer automation for opening apps and managing files
    - Custom agent creation with specialized capabilities
    
    Important Notes:
    - Always ensure proper API key configuration
    - Test all functionality before production use
    - Review security settings for computer automation
    
    Contact: support@aiagents.com
    `;
    
    await fs.writeFile(testFilePath, testContent);
    
    // Test file analysis
    const analysisResult = await fileSearchAgent.analyzeFile(testFilePath, 'test-document.txt');
    
    if (analysisResult.success) {
      console.log('✅ File analysis test passed');
      console.log('📄 File size:', analysisResult.file.size, 'bytes');
      console.log('🔤 Word count:', analysisResult.content.wordCount);
    }
    
    // Test file search
    const searchResult = await fileSearchAgent.searchInFile(testFilePath, 'API key configuration');
    
    if (searchResult.success) {
      console.log('✅ File search test passed');
      console.log('🔍 Found', searchResult.results.totalMatches, 'matches');
      console.log('🤖 AI Answer:', searchResult.aiAnswer.answer.substring(0, 100) + '...\n');
    }
    
    // Clean up test file
    await fs.remove(testFilePath);
    
  } catch (error) {
    console.log('❌ File Search Agent test error:', error.message);
  }
}

async function testComputerUseAgent() {
  console.log('🖥️ Testing Computer Use Agent...');
  const computerUseAgent = new ComputerUseAgent();
  
  try {
    // Test system info
    const sysInfoResult = await computerUseAgent.execute({
      action: 'get_system_info'
    });
    
    if (sysInfoResult.success) {
      console.log('✅ System info test passed');
      console.log('💻 Platform:', sysInfoResult.info.platform);
      console.log('🧮 CPUs:', sysInfoResult.info.cpus);
    }
    
    // Test file operations
    const testDir = './test-folder';
    const createFolderResult = await computerUseAgent.execute({
      action: 'create_folder',
      parameters: { folderPath: testDir }
    });
    
    if (createFolderResult.success) {
      console.log('✅ Create folder test passed');
      
      // List files in current directory
      const listResult = await computerUseAgent.execute({
        action: 'list_files',
        parameters: { directory: '.' }
      });
      
      if (listResult.success) {
        console.log('✅ List files test passed');
        console.log('📁 Found', listResult.files.length, 'items in current directory');
      }
      
      // Clean up
      await computerUseAgent.execute({
        action: 'delete_file',
        parameters: { filePath: testDir }
      });
    }
    
    console.log('');
  } catch (error) {
    console.log('❌ Computer Use Agent test error:', error.message);
  }
}

async function testAgentSDK() {
  console.log('🤖 Testing Agent SDK...');
  const agentSDK = new AgentSDK();
  
  try {
    // Create a custom travel booking agent
    const agentResult = await agentSDK.createAgent({
      name: 'TravelBookingAgent',
      description: 'A specialized agent for helping with travel planning and booking',
      capabilities: ['web_search', 'information_gathering', 'recommendation'],
      tools: ['web_search'],
      systemPrompt: 'You are a travel booking specialist. Help users plan trips, find flights, hotels, and provide travel recommendations.'
    });
    
    if (agentResult.success) {
      console.log('✅ Agent creation test passed');
      console.log('🆔 Agent ID:', agentResult.agent.id);
      console.log('📛 Agent Name:', agentResult.agent.name);
      
      // Test agent execution
      const executionResult = await agentSDK.executeAgent(
        agentResult.agent.id,
        'Help me plan a weekend trip to Paris. What are the top attractions?',
        {
          query: 'Paris weekend trip top attractions 2024'
        }
      );
      
      if (executionResult.success) {
        console.log('✅ Agent execution test passed');
        console.log('📋 Task Analysis:', executionResult.analysis.taskType);
        console.log('🎯 Response:', executionResult.response.substring(0, 150) + '...');
      }
      
      // Test agent listing
      const agentsList = agentSDK.listAgents();
      console.log('✅ Agent listing test passed');
      console.log('📊 Total agents:', agentsList.total);
    }
    
    console.log('');
  } catch (error) {
    console.log('❌ Agent SDK test error:', error.message);
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Running comprehensive AI Agents SDK tests...\n');
    
    await testResponsesAPI();
    await testWebSearchAgent();
    await testFileSearchAgent();
    await testComputerUseAgent();
    await testAgentSDK();
    
    console.log('🎉 All tests completed!\n');
    console.log('📝 Next Steps:');
    console.log('1. Create a .env file with your OPENAI_API_KEY');
    console.log('2. Run: npm install');
    console.log('3. Run: npm start');
    console.log('4. Visit: http://localhost:3000');
    console.log('5. Start building amazing AI agents! 🤖✨');
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
} 