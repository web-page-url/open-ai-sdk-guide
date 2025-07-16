import fs from 'fs-extra';
import path from 'path';
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';
import { createChatCompletion } from '../config/openai.js';

export class FileSearchAgent {
  constructor() {
    this.name = 'FileSearchAgent';
    this.description = 'AI agent that can read and search inside files (PDFs, Word docs, Excel, etc.)';
    this.capabilities = ['file_reading', 'content_extraction', 'file_search', 'document_analysis'];
    this.supportedFormats = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.csv', '.json'];
  }

  /**
   * Analyze and extract content from an uploaded file
   */
  async analyzeFile(filePath, originalName) {
    try {
      console.log(`📄 Analyzing file: ${originalName}`);
      
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error('File not found');
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      const fileExtension = path.extname(originalName).toLowerCase();
      
      // Extract content based on file type
      let content = '';
      let metadata = {};

      switch (fileExtension) {
        case '.pdf':
          const pdfResult = await this.extractPdfContent(filePath);
          content = pdfResult.content;
          metadata = pdfResult.metadata;
          break;
        case '.docx':
        case '.doc':
          const docResult = await this.extractWordContent(filePath);
          content = docResult.content;
          metadata = docResult.metadata;
          break;
        case '.xlsx':
        case '.xls':
          const excelResult = await this.extractExcelContent(filePath);
          content = excelResult.content;
          metadata = excelResult.metadata;
          break;
        case '.txt':
          content = await fs.readFile(filePath, 'utf8');
          metadata = { type: 'text', encoding: 'utf8' };
          break;
        case '.csv':
          content = await this.extractCsvContent(filePath);
          metadata = { type: 'csv' };
          break;
        case '.json':
          const jsonContent = await fs.readJson(filePath);
          content = JSON.stringify(jsonContent, null, 2);
          metadata = { type: 'json', structure: 'parsed' };
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Generate AI summary
      const analysis = await this.generateAnalysis(content, originalName, fileExtension);

      return {
        success: true,
        file: {
          name: originalName,
          path: filePath,
          size: stats.size,
          extension: fileExtension,
          created: stats.birthtime,
          modified: stats.mtime
        },
        content: {
          text: content.substring(0, 10000), // Limit preview
          length: content.length,
          wordCount: content.split(/\s+/).length
        },
        metadata,
        analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('File analysis error:', error);
      return {
        success: false,
        error: error.message,
        file: { name: originalName, path: filePath },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search for specific content within a file
   */
  async searchInFile(filePath, query, options = {}) {
    try {
      console.log(`🔍 Searching in file: ${path.basename(filePath)} for: "${query}"`);
      
      // Read file content
      const fileExtension = path.extname(filePath).toLowerCase();
      let content = '';

      switch (fileExtension) {
        case '.pdf':
          const pdfResult = await this.extractPdfContent(filePath);
          content = pdfResult.content;
          break;
        case '.docx':
        case '.doc':
          const docResult = await this.extractWordContent(filePath);
          content = docResult.content;
          break;
        case '.xlsx':
        case '.xls':
          const excelResult = await this.extractExcelContent(filePath);
          content = excelResult.content;
          break;
        case '.txt':
          content = await fs.readFile(filePath, 'utf8');
          break;
        case '.csv':
          content = await this.extractCsvContent(filePath);
          break;
        case '.json':
          const jsonContent = await fs.readJson(filePath);
          content = JSON.stringify(jsonContent, null, 2);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Perform search
      const searchResults = this.performTextSearch(content, query, options);
      
      // Generate AI-powered answer
      const aiAnswer = await this.generateSearchAnswer(content, query, searchResults);

      return {
        success: true,
        query,
        file: path.basename(filePath),
        results: searchResults,
        aiAnswer,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('File search error:', error);
      return {
        success: false,
        error: error.message,
        query,
        file: path.basename(filePath),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract content from PDF files - REAL IMPLEMENTATION using pdf2json
   */
  async extractPdfContent(filePath) {
    try {
      console.log(`📄 EXTRACTING REAL PDF CONTENT from: ${filePath}`);
      
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`PDF file not found: ${filePath}`);
      }
      
      // Get file stats
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      console.log(`📊 PDF file info: ${fileName} (${stats.size} bytes)`);
      
      // **REAL PDF TEXT EXTRACTION using pdf2json**
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', (errData) => {
          console.error(`❌ PDF Parser Error:`, errData);
          // Return basic info if parsing fails
          resolve({
            content: `PDF parsing failed: ${errData.parserError}. This might be a scanned PDF, password-protected file, or corrupted PDF.`,
            metadata: {
              type: 'pdf',
              pages: 0,
              size: stats.size,
              fileName: fileName,
              created: stats.birthtime,
              modified: stats.mtime,
              error: errData.parserError,
              info: { 
                title: fileName,
                size: stats.size,
                sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`
              }
            }
          });
        });

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          try {
            console.log(`✅ PDF parsed successfully!`);
            
            // Extract text from all pages
            let extractedText = '';
            let pageCount = 0;
            
            if (pdfData.Pages && pdfData.Pages.length > 0) {
              pageCount = pdfData.Pages.length;
              console.log(`📊 PDF has ${pageCount} pages`);
              
              pdfData.Pages.forEach((page, pageIndex) => {
                if (page.Texts && page.Texts.length > 0) {
                  page.Texts.forEach((textItem) => {
                    if (textItem.R && textItem.R.length > 0) {
                      textItem.R.forEach((textRun) => {
                        if (textRun.T) {
                          // Decode URI component and clean up text
                          extractedText += decodeURIComponent(textRun.T) + ' ';
                        }
                      });
                    }
                  });
                  extractedText += '\n'; // Add line break after each text block
                }
              });
            }

            // Clean up the extracted text
            const cleanText = extractedText
              .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
              .replace(/\n\s*\n/g, '\n')  // Remove extra line breaks
              .trim();

            console.log(`📊 PDF Statistics:`, {
              pages: pageCount,
              textLength: cleanText.length,
              firstFewChars: cleanText.substring(0, 100) + '...'
            });

            resolve({
              content: cleanText,
              metadata: {
                type: 'pdf',
                pages: pageCount,
                size: stats.size,
                fileName: fileName,
                created: stats.birthtime,
                modified: stats.mtime,
                info: { 
                  title: pdfData.Meta?.Title || fileName,
                  author: pdfData.Meta?.Author || 'Unknown',
                  subject: pdfData.Meta?.Subject || '',
                  creator: pdfData.Meta?.Creator || '',
                  producer: pdfData.Meta?.Producer || '',
                  creationDate: pdfData.Meta?.CreationDate || '',
                  size: stats.size,
                  sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`
                }
              }
            });
          } catch (processingError) {
            console.error(`❌ PDF processing error:`, processingError);
            resolve({
              content: `PDF text extraction failed during processing: ${processingError.message}`,
              metadata: {
                type: 'pdf',
                pages: 0,
                size: stats.size,
                fileName: fileName,
                created: stats.birthtime,
                modified: stats.mtime,
                error: processingError.message,
                info: { 
                  title: fileName,
                  size: stats.size,
                  sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`
                }
              }
            });
          }
        });

        // Load and parse the PDF file
        pdfParser.loadPDF(filePath);
      });
      
    } catch (error) {
      console.error(`❌ PDF extraction error for ${filePath}:`, error);
      
      // If PDF parsing fails, at least provide basic info
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      return {
        content: `Unable to extract text from PDF: ${error.message}. This might be a scanned PDF or password-protected file.`,
        metadata: {
          type: 'pdf',
          pages: 0,
          size: stats.size,
          fileName: fileName,
          created: stats.birthtime,
          modified: stats.mtime,
          error: error.message,
          info: { 
            title: fileName,
            size: stats.size,
            sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`
          }
        }
      };
    }
  }

  /**
   * Extract content from Word documents
   */
  async extractWordContent(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      return {
        content: result.value,
        metadata: {
          type: 'word',
          warnings: result.messages.length > 0 ? result.messages : undefined
        }
      };
    } catch (error) {
      throw new Error(`Word document extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract content from Excel files
   */
  async extractExcelContent(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      const content = [];
      const metadata = {
        type: 'excel',
        sheets: [],
        totalSheets: workbook.SheetNames.length
      };

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        metadata.sheets.push({
          name: sheetName,
          rows: jsonData.length,
          columns: jsonData[0] ? jsonData[0].length : 0
        });

        content.push(`Sheet: ${sheetName}`);
        jsonData.forEach((row, index) => {
          if (row.length > 0) {
            content.push(`Row ${index + 1}: ${row.join(' | ')}`);
          }
        });
        content.push(''); // Add empty line between sheets
      });

      return {
        content: content.join('\n'),
        metadata
      };
    } catch (error) {
      throw new Error(`Excel extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract content from CSV files
   */
  async extractCsvContent(filePath) {
    try {
      const csvContent = await fs.readFile(filePath, 'utf8');
      const lines = csvContent.split('\n');
      const content = [];

      lines.forEach((line, index) => {
        if (line.trim()) {
          content.push(`Row ${index + 1}: ${line}`);
        }
      });

      return content.join('\n');
    } catch (error) {
      throw new Error(`CSV extraction failed: ${error.message}`);
    }
  }

  /**
   * Perform text-based search within content
   */
  performTextSearch(content, query, options = {}) {
    const {
      caseSensitive = false,
      wholeWord = false,
      maxResults = 10,
      contextLength = 100
    } = options;

    const searchPattern = wholeWord 
      ? new RegExp(`\\b${query}\\b`, caseSensitive ? 'g' : 'gi')
      : new RegExp(query, caseSensitive ? 'g' : 'gi');

    const matches = [];
    let match;

    while ((match = searchPattern.exec(content)) !== null && matches.length < maxResults) {
      const start = Math.max(0, match.index - contextLength);
      const end = Math.min(content.length, match.index + match[0].length + contextLength);
      
      matches.push({
        match: match[0],
        position: match.index,
        context: content.substring(start, end),
        lineNumber: content.substring(0, match.index).split('\n').length
      });
    }

    return {
      totalMatches: matches.length,
      matches,
      searchOptions: options
    };
  }

  /**
   * Generate AI-powered analysis of the file
   */
  async generateAnalysis(content, fileName, fileType) {
    try {
      const messages = [
        {
          role: 'system',
          content: 'You are a document analysis expert. Analyze the provided document content and provide insights about its structure, key topics, and important information.'
        },
        {
          role: 'user',
          content: `Analyze this ${fileType} file named "${fileName}":\n\n${content.substring(0, 3000)}...\n\nProvide a summary including:\n1. Document type and purpose\n2. Key topics or sections\n3. Important information or data\n4. Overall structure`
        }
      ];

      const response = await createChatCompletion(messages, {
        max_tokens: 500,
        temperature: 0.3
      });

      return {
        summary: response.choices[0].message.content,
        generated: true
      };
    } catch (error) {
      console.error('Analysis generation error:', error);
      return {
        summary: 'Analysis could not be generated at this time.',
        generated: false,
        error: error.message
      };
    }
  }

  /**
   * Generate AI-powered answer to search query
   */
  async generateSearchAnswer(content, query, searchResults) {
    try {
      const context = searchResults.matches.map(match => match.context).join('\n\n');
      
      const messages = [
        {
          role: 'system',
          content: 'You are a document search assistant. Based on the search results from a document, provide a clear and accurate answer to the user\'s question.'
        },
        {
          role: 'user',
          content: `Question: "${query}"\n\nRelevant excerpts from document:\n${context}\n\nPlease provide a comprehensive answer based on the document content.`
        }
      ];

      const response = await createChatCompletion(messages, {
        max_tokens: 300,
        temperature: 0.3
      });

      return {
        answer: response.choices[0].message.content,
        confidence: searchResults.totalMatches > 0 ? 'high' : 'low',
        basedOnMatches: searchResults.totalMatches
      };
    } catch (error) {
      console.error('Search answer generation error:', error);
      return {
        answer: 'Unable to generate answer at this time.',
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * Extract specific data types from files
   */
  async extractSpecificData(filePath, dataType) {
    const dataTypes = {
      dates: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g,
      emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phones: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      urls: /https?:\/\/[^\s]+/g,
      numbers: /\d+\.?\d*/g,
      currencies: /[$€£¥]\s*\d+(?:,\d{3})*(?:\.\d{2})?/g
    };

    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      let content = '';

      // Extract content based on file type (reuse existing methods)
      switch (fileExtension) {
        case '.pdf':
          const pdfResult = await this.extractPdfContent(filePath);
          content = pdfResult.content;
          break;
        case '.docx':
        case '.doc':
          const docResult = await this.extractWordContent(filePath);
          content = docResult.content;
          break;
        case '.txt':
          content = await fs.readFile(filePath, 'utf8');
          break;
        default:
          throw new Error(`Unsupported file format for data extraction: ${fileExtension}`);
      }

      const pattern = dataTypes[dataType];
      if (!pattern) {
        throw new Error(`Unsupported data type: ${dataType}`);
      }

      const matches = content.match(pattern) || [];
      return {
        success: true,
        dataType,
        matches: [...new Set(matches)], // Remove duplicates
        count: matches.length,
        file: path.basename(filePath)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        dataType,
        file: path.basename(filePath)
      };
    }
  }

  /**
   * Get agent status and capabilities
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      available: true,
      supportedFormats: this.supportedFormats,
      features: [
        'Word document reading',
        'Excel spreadsheet parsing',
        'Text and CSV analysis',
        'JSON file processing',
        'Content search and analysis',
        'AI-powered document insights',
        'Specific data extraction'
      ]
    };
  }
} 