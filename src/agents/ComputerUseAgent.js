import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { createChatCompletion } from '../config/openai.js';

const execAsync = promisify(exec);

export class ComputerUseAgent {
  constructor() {
    this.name = 'ComputerUseAgent';
    this.description = 'AI agent that can use your computer like a human - open apps, rename files, send emails';
    this.capabilities = ['file_operations', 'app_control', 'web_automation', 'system_commands'];
    this.browser = null;
  }

  /**
   * Execute a computer automation task
   */
  async execute(task) {
    try {
      console.log(`🖥️ Executing computer task: ${task.command || task.action}`);
      
      const { command, action, parameters = {} } = task;

      if (command) {
        return await this.executeCommand(command, parameters);
      }

      if (action) {
        return await this.executeAction(action, parameters);
      }

      throw new Error('No command or action specified');
    } catch (error) {
      console.error('Computer use error:', error);
      return {
        success: false,
        error: error.message,
        task,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute system commands
   */
  async executeCommand(command, parameters = {}) {
    const { timeout = 30000, workingDirectory } = parameters;

    try {
      // Security check - only allow safe commands
      if (!this.isSafeCommand(command)) {
        throw new Error('Command not allowed for security reasons');
      }

      const options = {
        timeout,
        maxBuffer: 1024 * 1024 // 1MB
      };

      if (workingDirectory) {
        options.cwd = workingDirectory;
      }

      const { stdout, stderr } = await execAsync(command, options);

      return {
        success: true,
        command,
        output: stdout,
        error: stderr || null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute predefined actions
   */
  async executeAction(action, parameters = {}) {
    switch (action.toLowerCase()) {
      case 'open_app':
        return await this.openApplication(parameters.appName || parameters.app);
      
      case 'open_file':
        return await this.openFile(parameters.filePath || parameters.path);
      
      case 'rename_file':
        return await this.renameFile(parameters.oldPath, parameters.newPath || parameters.newName);
      
      case 'create_folder':
        return await this.createFolder(parameters.folderPath || parameters.path);
      
      case 'list_files':
        return await this.listFiles(parameters.directory || parameters.path || '.');
      
      case 'copy_file':
        return await this.copyFile(parameters.source, parameters.destination);
      
      case 'move_file':
        return await this.moveFile(parameters.source, parameters.destination);
      
      case 'delete_file':
        return await this.deleteFile(parameters.filePath || parameters.path);
      
      case 'browse_web':
        return await this.browseWeb(parameters.url, parameters);
      
      case 'send_email':
        return await this.sendEmail(parameters);
      
      case 'take_screenshot':
        return await this.takeScreenshot(parameters.outputPath);
      
      case 'get_system_info':
        return await this.getSystemInfo();
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Open an application
   */
  async openApplication(appName) {
    try {
      let command;
      const platform = process.platform;

      switch (platform) {
        case 'win32':
          command = `start "" "${appName}"`;
          break;
        case 'darwin':
          command = `open -a "${appName}"`;
          break;
        case 'linux':
          command = appName.toLowerCase();
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const result = await this.executeCommand(command);
      
      return {
        ...result,
        action: 'open_app',
        appName,
        platform
      };
    } catch (error) {
      return {
        success: false,
        action: 'open_app',
        appName,
        error: error.message
      };
    }
  }

  /**
   * Open a file with default application
   */
  async openFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error('File not found');
      }

      let command;
      const platform = process.platform;

      switch (platform) {
        case 'win32':
          command = `start "" "${filePath}"`;
          break;
        case 'darwin':
          command = `open "${filePath}"`;
          break;
        case 'linux':
          command = `xdg-open "${filePath}"`;
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const result = await this.executeCommand(command);
      
      return {
        ...result,
        action: 'open_file',
        filePath
      };
    } catch (error) {
      return {
        success: false,
        action: 'open_file',
        filePath,
        error: error.message
      };
    }
  }

  /**
   * Rename a file or folder
   */
  async renameFile(oldPath, newPath) {
    try {
      if (!await fs.pathExists(oldPath)) {
        throw new Error('Source file not found');
      }

      // If newPath is just a name, use the same directory
      if (!path.dirname(newPath) || path.dirname(newPath) === '.') {
        newPath = path.join(path.dirname(oldPath), newPath);
      }

      await fs.rename(oldPath, newPath);

      return {
        success: true,
        action: 'rename_file',
        oldPath,
        newPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'rename_file',
        oldPath,
        newPath,
        error: error.message
      };
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(folderPath) {
    try {
      await fs.ensureDir(folderPath);

      return {
        success: true,
        action: 'create_folder',
        folderPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'create_folder',
        folderPath,
        error: error.message
      };
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directory) {
    try {
      const files = await fs.readdir(directory);
      const fileDetails = [];

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        fileDetails.push({
          name: file,
          path: filePath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        });
      }

      return {
        success: true,
        action: 'list_files',
        directory,
        files: fileDetails,
        count: fileDetails.length
      };
    } catch (error) {
      return {
        success: false,
        action: 'list_files',
        directory,
        error: error.message
      };
    }
  }

  /**
   * Copy a file
   */
  async copyFile(source, destination) {
    try {
      await fs.copy(source, destination);

      return {
        success: true,
        action: 'copy_file',
        source,
        destination,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'copy_file',
        source,
        destination,
        error: error.message
      };
    }
  }

  /**
   * Move a file
   */
  async moveFile(source, destination) {
    try {
      await fs.move(source, destination);

      return {
        success: true,
        action: 'move_file',
        source,
        destination,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'move_file',
        source,
        destination,
        error: error.message
      };
    }
  }

  /**
   * Delete a file or folder
   */
  async deleteFile(filePath) {
    try {
      await fs.remove(filePath);

      return {
        success: true,
        action: 'delete_file',
        filePath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'delete_file',
        filePath,
        error: error.message
      };
    }
  }

  /**
   * Browse web and interact with pages
   */
  async browseWeb(url, options = {}) {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({ 
          headless: options.headless !== false,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const page = await this.browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const result = {
        success: true,
        action: 'browse_web',
        url,
        title: await page.title(),
        timestamp: new Date().toISOString()
      };

      // Perform specific actions if requested
      if (options.screenshot) {
        const screenshotPath = options.screenshotPath || `screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        result.screenshot = screenshotPath;
      }

      if (options.extractText) {
        const text = await page.evaluate(() => document.body.innerText);
        result.text = text.substring(0, 2000); // Limit text length
      }

      if (options.click) {
        await page.click(options.click);
        result.clicked = options.click;
      }

      if (options.type) {
        await page.type(options.type.selector, options.type.text);
        result.typed = { selector: options.type.selector, text: options.type.text };
      }

      await page.close();
      return result;
    } catch (error) {
      return {
        success: false,
        action: 'browse_web',
        url,
        error: error.message
      };
    }
  }

  /**
   * Send email (requires email configuration)
   */
  async sendEmail(options) {
    try {
      // This is a placeholder implementation
      // In a real-world scenario, you'd integrate with email services
      const { to, subject, body, provider = 'default' } = options;

      if (!to || !subject || !body) {
        throw new Error('Email requires to, subject, and body parameters');
      }

      // For now, we'll simulate email sending
      // You could integrate with services like SendGrid, Nodemailer, etc.
      
      return {
        success: true,
        action: 'send_email',
        to,
        subject,
        bodyLength: body.length,
        provider,
        simulated: true,
        message: 'Email sending is simulated. Integrate with email service for actual sending.',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'send_email',
        error: error.message
      };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(outputPath) {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({ headless: true });
      }

      const page = await this.browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      const screenshotPath = outputPath || `screenshot-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      await page.close();

      return {
        success: true,
        action: 'take_screenshot',
        outputPath: screenshotPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'take_screenshot',
        error: error.message
      };
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    try {
      const info = {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem(),
        uptime: require('os').uptime(),
        hostname: require('os').hostname(),
        homeDirectory: require('os').homedir(),
        temporaryDirectory: require('os').tmpdir()
      };

      return {
        success: true,
        action: 'get_system_info',
        info,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        action: 'get_system_info',
        error: error.message
      };
    }
  }

  /**
   * Check if a command is safe to execute
   */
  isSafeCommand(command) {
    // List of potentially dangerous commands to block
    const dangerousCommands = [
      'rm -rf',
      'del /f',
      'format',
      'fdisk',
      'mkfs',
      'dd if=',
      'shutdown',
      'reboot',
      'halt',
      'su ',
      'sudo ',
      'chmod 777',
      'chown',
      'passwd',
      'useradd',
      'userdel',
      'netsh',
      'reg delete',
      'taskkill /f'
    ];

    const lowerCommand = command.toLowerCase();
    return !dangerousCommands.some(dangerous => lowerCommand.includes(dangerous));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
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
      platform: process.platform,
      actions: [
        'open_app',
        'open_file',
        'rename_file',
        'create_folder',
        'list_files',
        'copy_file',
        'move_file',
        'delete_file',
        'browse_web',
        'send_email',
        'take_screenshot',
        'get_system_info'
      ],
      features: [
        'File system operations',
        'Application launching',
        'Web browser automation',
        'System information',
        'Screenshot capture',
        'Safe command execution'
      ]
    };
  }
} 