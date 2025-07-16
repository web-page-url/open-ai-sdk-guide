import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

// Import our agent modules
import { AgentSDK } from './agents/AgentSDK.js';
import { WebSearchAgent } from './agents/WebSearchAgent.js';
import { FileSearchAgent } from './agents/FileSearchAgent.js';
import { ComputerUseAgent } from './agents/ComputerUseAgent.js';
import { OpenAIAgentsSDK } from './agents/OpenAIAgentsSDK.js';
import { ResponsesAPI } from './api/ResponsesAPI.js';
import TextToSpeechAgent from './agents/TextToSpeechAgent.js';
import TextToImageAgent from './agents/TextToImageAgent.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize server with proper async handling
async function initializeServer() {
  try {
    // Ensure upload directory exists
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await fs.ensureDir(uploadDir);
    console.log(`📁 Upload directory ensured: ${uploadDir}`);

    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        console.log(`📂 Saving file to: ${uploadDir}`);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
        console.log(`📄 Generated filename: ${filename}`);
        cb(null, filename);
      }
    });

    const upload = multer({ 
      storage: storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
      },
      fileFilter: (req, file, cb) => {
        console.log(`🔍 File filter check: ${file.mimetype}`);
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF files are allowed.`), false);
        }
      }
    });

    // Debug middleware to log all requests
    app.use((req, res, next) => {
      console.log(`📝 ${req.method} ${req.url} - ${new Date().toISOString()}`);
      if (req.method === 'POST' && req.url.includes('file-upload')) {
        console.log('🔍 File upload request detected');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);
      }
      next();
    });

    // Serve static files
    app.use(express.static('public'));

    // Initialize agents
    const agentSDK = new AgentSDK();
    const webSearchAgent = new WebSearchAgent();
    const fileSearchAgent = new FileSearchAgent();
    const computerUseAgent = new ComputerUseAgent();
    const openaiAgentsSDK = new OpenAIAgentsSDK();
    const responsesAPI = new ResponsesAPI();
    const textToSpeechAgent = new TextToSpeechAgent(process.env.OPENAI_API_KEY);
    const textToImageAgent = new TextToImageAgent(process.env.OPENAI_API_KEY);

    // Health check endpoint for deployment
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });

    // Routes
    app.get('/', (req, res) => {
      res.json({
        message: 'AI Agents SDK Server',
        version: '1.0.0',
        endpoints: {
          'POST /api/chat': 'General chat with AI',
          'POST /api/web-search': 'Web search capabilities',
          'POST /api/file-upload': 'Upload and analyze files',
          'POST /api/file-search': 'Search within uploaded files',
          'POST /api/chat-pdf': 'Chat with PDF documents for summaries and Q&A',
          'POST /api/computer-use': 'Computer automation tasks',
          'POST /api/text-to-speech': 'Convert text to speech audio 🗣️',
          'GET /api/text-to-speech/voices': 'Get available TTS voices',
          'POST /api/text-to-image': 'Generate images from text descriptions 🖼️',
          'GET /api/text-to-image/models': 'Get available image generation models',
          'GET /api/agents': 'List available agents',
          'POST /api/agents/create': 'Create a custom agent',
          'POST /api/agents/:id/execute': 'Execute an agent task',
          'POST /api/openai-agents/run': 'Run OpenAI Agents SDK agents',
          'POST /api/openai-agents/create': 'Create custom OpenAI agents',
          'GET /api/openai-agents': 'List OpenAI agents',
          'GET /openai-agents.html': 'OpenAI Agents SDK frontend interface',
          'GET /text-to-speech.html': 'Text-to-Speech frontend interface',
          'GET /text-to-image.html': 'Text-to-Image frontend interface'
        }
      });
    });

    // Chat endpoint using Responses API
    app.post('/api/chat', async (req, res) => {
      try {
        const { message, model, temperature, max_tokens } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        const response = await responsesAPI.chat({
          message,
          model: model || process.env.DEFAULT_MODEL,
          temperature: temperature || parseFloat(process.env.TEMPERATURE),
          max_tokens: max_tokens || parseInt(process.env.MAX_TOKENS)
        });

        res.json(response);
      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // Web search endpoint
    app.post('/api/web-search', async (req, res) => {
      try {
        const { query, maxResults } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Search query is required' });
        }

        const results = await webSearchAgent.search(query, maxResults);
        res.json(results);
      } catch (error) {
        console.error('Web search error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // File upload endpoint with comprehensive error handling
    app.post('/api/file-upload', (req, res) => {
      console.log(`📥 File upload request received`);
      console.log(`📋 Headers:`, req.headers);
      
      // Use multer middleware
      upload.single('file')(req, res, async (err) => {
        if (err) {
          console.error('❌ Multer error:', err);
          return res.status(400).json({ 
            success: false,
            error: 'File upload error', 
            details: err.message 
          });
        }

        try {
          if (!req.file) {
            console.log('❌ No file in request');
            console.log('Body:', req.body);
            return res.status(400).json({ 
              success: false,
              error: 'No file uploaded',
              details: 'Please select a PDF file to upload'
            });
          }

          console.log(`📄 Processing file: ${req.file.originalname}`);
          console.log(`📊 File details:`, {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
            path: req.file.path
          });
          
          // Validate file type
          if (req.file.mimetype !== 'application/pdf') {
            console.log(`❌ Invalid file type: ${req.file.mimetype}`);
            return res.status(400).json({
              success: false,
              error: 'Invalid file type',
              details: 'Only PDF files are allowed'
            });
          }
          
          const analysis = await fileSearchAgent.analyzeFile(req.file.path, req.file.originalname);
          
          console.log(`✅ Analysis completed for: ${req.file.originalname}`);
          
          res.json({
            success: true,
            message: 'File uploaded and analyzed successfully',
            file: {
              originalName: req.file.originalname,
              path: req.file.path,
              size: req.file.size,
              mimetype: req.file.mimetype
            },
            analysis
          });
          
        } catch (error) {
          console.error('❌ Analysis error:', error);
          console.error('Stack:', error.stack);
          
          res.status(500).json({ 
            success: false,
            error: 'File analysis failed', 
            details: error.message,
            file: req.file ? {
              originalName: req.file.originalname,
              path: req.file.path,
              size: req.file.size
            } : null
          });
        }
      });
    });

    // File search endpoint
    app.post('/api/file-search', async (req, res) => {
      try {
        const { query, filePath } = req.body;
        
        if (!query || !filePath) {
          return res.status(400).json({ error: 'Query and file path are required' });
        }

        const results = await fileSearchAgent.searchInFile(filePath, query);
        res.json(results);
      } catch (error) {
        console.error('File search error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // PDF Chat endpoint - for chat-pdf.html page
    app.post('/api/chat-pdf', async (req, res) => {
      try {
        const { message, filePath, fileName } = req.body;
        
        if (!message || !filePath) {
          return res.status(400).json({ error: 'Message and file path are required' });
        }

        // Check if file exists
        if (!await fs.pathExists(filePath)) {
          return res.status(404).json({ error: 'File not found' });
        }

        // Read and analyze the PDF content
        const fileAnalysis = await fileSearchAgent.analyzeFile(filePath, fileName || path.basename(filePath));
        
        if (!fileAnalysis.success) {
          return res.status(500).json({ error: 'Failed to analyze PDF', details: fileAnalysis.error });
        }

        // Create a context-aware prompt for PDF chat
        const systemPrompt = `You are an AI assistant specialized in analyzing and discussing PDF documents. 
        You have access to the full content of a PDF document titled "${fileName || 'Document'}".
        
        Document Summary:
        - File: ${fileName || 'Document'}
        - Pages: ${fileAnalysis.metadata?.pages || 'Unknown'}
        - Word Count: ${fileAnalysis.content?.wordCount || 'Unknown'}
        
        The user is asking about this document. Please provide helpful, accurate responses based on the document content.
        If the user asks for a summary, provide a comprehensive summary of the key points.
        If they ask specific questions, search through the content to provide accurate answers.
        
        Document Content Preview:
        ${fileAnalysis.content?.text?.substring(0, 3000) || 'Content not available'}...`;

        // Generate AI response using the document context
        console.log(`🤖 Generating AI response for: "${message}"`);
        
        const aiResponse = await responsesAPI.chat({
          message: `User Question: ${message}\n\nPlease answer based on the PDF document content provided in the system context.`,
          systemPrompt: systemPrompt,
          model: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 1000
        });

        console.log(`🔍 AI Response:`, aiResponse);
        
        // Extract the response correctly
        let responseText = 'Sorry, I could not generate a response.';
        if (aiResponse.success && aiResponse.response) {
          responseText = aiResponse.response;
        } else if (aiResponse.message) {
          responseText = aiResponse.message;
        } else if (aiResponse.content) {
          responseText = aiResponse.content;
        } else {
          console.error('❌ No valid response found in:', aiResponse);
        }

        res.json({
          success: true,
          response: responseText,
          file: {
            name: fileName,
            path: filePath,
            pages: fileAnalysis.metadata?.pages,
            wordCount: fileAnalysis.content?.wordCount
          },
          aiResponseDebug: aiResponse, // Add this for debugging
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ PDF Chat error:', error);
        console.error('Error stack:', error.stack);
        
        // Check if it's an OpenAI API error
        if (error.message.includes('API key') || error.message.includes('OpenAI')) {
          res.status(500).json({ 
            success: false,
            error: 'OpenAI API Error', 
            details: 'Please check your OPENAI_API_KEY in the .env file. ' + error.message
          });
        } else {
          res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
          });
        }
      }
    });

    // Computer use endpoint
    app.post('/api/computer-use', async (req, res) => {
      try {
        const { command, action, parameters } = req.body;
        
        if (!command && !action) {
          return res.status(400).json({ error: 'Command or action is required' });
        }

        const result = await computerUseAgent.execute({ command, action, parameters });
        res.json(result);
      } catch (error) {
        console.error('Computer use error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // Agents management endpoints
    app.get('/api/agents', (req, res) => {
      const agents = agentSDK.listAgents();
      res.json(agents);
    });

    app.post('/api/agents/create', async (req, res) => {
      try {
        const { name, description, capabilities, systemPrompt } = req.body;
        
        if (!name || !capabilities) {
          return res.status(400).json({ error: 'Name and capabilities are required' });
        }

        const agent = await agentSDK.createAgent({
          name,
          description,
          capabilities,
          systemPrompt
        });

        res.json(agent);
      } catch (error) {
        console.error('Agent creation error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    app.post('/api/agents/:id/execute', async (req, res) => {
      try {
        const { id } = req.params;
        const { task, context } = req.body;
        
        if (!task) {
          return res.status(400).json({ error: 'Task is required' });
        }

        const result = await agentSDK.executeAgent(id, task, context);
        res.json(result);
      } catch (error) {
        console.error('Agent execution error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // OpenAI Agents SDK endpoints
    app.post('/api/openai-agents/run', async (req, res) => {
      try {
        const { agentType, input } = req.body;
        
        if (!agentType || !input) {
          return res.status(400).json({ 
            success: false,
            error: 'Agent type and input are required' 
          });
        }

        console.log(`🤖 Running OpenAI Agent: ${agentType} with input: "${input}"`);
        
        const result = await openaiAgentsSDK.runAgent(agentType, input);
        res.json(result);
      } catch (error) {
        console.error('OpenAI Agents SDK error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    app.post('/api/openai-agents/create', async (req, res) => {
      try {
        const { name, instructions, model } = req.body;
        
        if (!name || !instructions) {
          return res.status(400).json({ 
            success: false,
            error: 'Name and instructions are required' 
          });
        }

        console.log(`🔧 Creating custom OpenAI Agent: ${name}`);
        
        const result = await openaiAgentsSDK.createCustomAgent(name, instructions, model);
        res.json(result);
      } catch (error) {
        console.error('Custom agent creation error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    app.get('/api/openai-agents', (req, res) => {
      try {
        const agents = openaiAgentsSDK.getAvailableAgents();
        res.json({
          success: true,
          agents: agents,
          count: agents.length
        });
      } catch (error) {
        console.error('List agents error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    app.get('/api/openai-agents/test', async (req, res) => {
      try {
        console.log('🧪 Running OpenAI Agents SDK test...');
        const testResult = await openaiAgentsSDK.testAgents();
        res.json(testResult);
      } catch (error) {
        console.error('Test agents error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Test failed', 
          details: error.message 
        });
      }
    });

    // Text-to-Speech endpoints
    app.post('/api/text-to-speech', async (req, res) => {
      try {
        const { text, voice, model, speed } = req.body;
        
        if (!text) {
          return res.status(400).json({ 
            success: false,
            error: 'Text is required' 
          });
        }

        console.log(`🗣️ Converting text to speech: "${text.substring(0, 50)}..."`);
        
        const result = await textToSpeechAgent.convertTextToSpeech(text, {
          voice,
          model,
          speed: speed ? parseFloat(speed) : undefined
        });

        if (result.success) {
          // Set appropriate headers for audio response
          res.setHeader('Content-Type', `audio/${result.format}`);
          res.setHeader('Content-Disposition', `attachment; filename="speech.${result.format}"`);
          res.send(result.audioBuffer);
        } else {
          res.status(500).json(result);
        }
      } catch (error) {
        console.error('Text-to-Speech error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    app.get('/api/text-to-speech/voices', (req, res) => {
      try {
        const voices = textToSpeechAgent.getAvailableVoices();
        const models = textToSpeechAgent.getAvailableModels();
        
        res.json({
          success: true,
          voices,
          models
        });
      } catch (error) {
        console.error('Get TTS voices error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    // Text-to-Image endpoints
    app.post('/api/text-to-image', async (req, res) => {
      try {
        const { prompt, model, size, quality, style, n } = req.body;
        
        if (!prompt) {
          return res.status(400).json({ 
            success: false,
            error: 'Prompt is required' 
          });
        }

        console.log(`🖼️ Generating image from prompt: "${prompt.substring(0, 50)}..."`);
        
        const result = await textToImageAgent.generateImage(prompt, {
          model,
          size,
          quality,
          style,
          n: n ? parseInt(n) : undefined
        });

        res.json(result);
      } catch (error) {
        console.error('Text-to-Image error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    app.get('/api/text-to-image/models', (req, res) => {
      try {
        const models = textToImageAgent.getAvailableModels();
        const qualityOptions = textToImageAgent.getQualityOptions();
        const styleOptions = textToImageAgent.getStyleOptions();
        const suggestedPrompts = textToImageAgent.getSuggestedPrompts();
        
        res.json({
          success: true,
          models,
          qualityOptions,
          styleOptions,
          suggestedPrompts,
          sizes: {
            'dall-e-2': textToImageAgent.getAvailableSizes('dall-e-2'),
            'dall-e-3': textToImageAgent.getAvailableSizes('dall-e-3')
          }
        });
      } catch (error) {
        console.error('Get image models error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Internal server error', 
          details: error.message 
        });
      }
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 AI Agents SDK Server running on port ${PORT}`);
      console.log(`📚 API Documentation available at http://localhost:${PORT}`);
      console.log('🔑 Make sure to set your OPENAI_API_KEY in the .env file');
    });
  } catch (error) {
    console.error('Server initialization failed:', error);
    process.exit(1);
  }
}

initializeServer(); 