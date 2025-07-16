import { createChatCompletion, config } from '../config/openai.js';

export class ResponsesAPI {
  constructor() {
    this.name = 'ResponsesAPI';
    this.description = 'Direct OpenAI API interface for developers to get smart responses';
  }

  /**
   * Simple chat completion
   */
  async chat(options) {
    const {
      message,
      model = config.model,
      temperature = config.temperature,
      max_tokens = config.max_tokens,
      systemPrompt = "You are a helpful AI assistant."
    } = options;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    try {
      const response = await createChatCompletion(messages, {
        model,
        temperature,
        max_tokens: max_tokens
      });

      return {
        success: true,
        response: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        created: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        created: new Date().toISOString()
      };
    }
  }

  /**
   * Multi-turn conversation
   */
  async conversation(messages, options = {}) {
    const {
      model = config.model,
      temperature = config.temperature,
      max_tokens = config.max_tokens,
      systemPrompt = "You are a helpful AI assistant."
    } = options;

    // Ensure system message is first
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    try {
      const response = await createChatCompletion(conversationMessages, {
        model,
        temperature,
        max_tokens: max_tokens
      });

      return {
        success: true,
        response: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        conversationLength: messages.length,
        created: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        created: new Date().toISOString()
      };
    }
  }

  /**
   * Streaming response for real-time applications
   */
  async *streamChat(options) {
    const {
      message,
      model = config.model,
      temperature = config.temperature,
      max_tokens = config.max_tokens,
      systemPrompt = "You are a helpful AI assistant."
    } = options;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    try {
      const stream = await createChatCompletion(messages, {
        model,
        temperature,
        max_tokens: max_tokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield {
            success: true,
            content,
            done: false
          };
        }
      }

      yield {
        success: true,
        content: '',
        done: true
      };
    } catch (error) {
      yield {
        success: false,
        error: error.message,
        done: true
      };
    }
  }

  /**
   * Analyze text for specific purposes
   */
  async analyze(text, analysisType = 'general', options = {}) {
    const prompts = {
      general: `Analyze the following text and provide insights: ${text}`,
      sentiment: `Analyze the sentiment of the following text (positive/negative/neutral): ${text}`,
      summary: `Provide a concise summary of the following text: ${text}`,
      keywords: `Extract the main keywords and key phrases from the following text: ${text}`,
      language: `Identify the language and detect any specific tone or style in: ${text}`,
      intent: `Determine the intent or purpose behind the following text: ${text}`
    };

    const prompt = prompts[analysisType] || prompts.general;

    return await this.chat({
      message: prompt,
      ...options
    });
  }

  /**
   * Generate content based on prompts
   */
  async generate(prompt, contentType = 'text', options = {}) {
    const systemPrompts = {
      text: "You are a creative writer. Generate high-quality text content based on the user's request.",
      code: "You are an expert programmer. Generate clean, well-commented code based on the user's specifications.",
      email: "You are a professional communication assistant. Generate appropriate email content.",
      blog: "You are a content creator. Generate engaging blog post content.",
      marketing: "You are a marketing expert. Generate compelling marketing content.",
      technical: "You are a technical writer. Generate clear, accurate technical documentation."
    };

    return await this.chat({
      message: prompt,
      systemPrompt: systemPrompts[contentType] || systemPrompts.text,
      ...options
    });
  }

  /**
   * Question and Answer functionality
   */
  async qa(question, context = '', options = {}) {
    const message = context 
      ? `Context: ${context}\n\nQuestion: ${question}`
      : question;

    return await this.chat({
      message,
      systemPrompt: "You are a knowledgeable assistant. Answer questions accurately and helpfully based on the provided context or your knowledge.",
      ...options
    });
  }

  /**
   * Get API status and usage information
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      available: true,
      endpoints: {
        chat: 'Simple chat completion',
        conversation: 'Multi-turn conversation',
        streamChat: 'Streaming responses',
        analyze: 'Text analysis',
        generate: 'Content generation',
        qa: 'Question and Answer'
      },
      supportedModels: [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4-turbo-preview',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k'
      ]
    };
  }
} 