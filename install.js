#!/usr/bin/env node

import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

console.log('🤖 AI Agents SDK Installation Script');
console.log('=====================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkNodeVersion() {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const majorVersion = parseInt(version.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.log('❌ Node.js version 18 or higher is required');
      console.log(`Current version: ${version}`);
      console.log('Please update Node.js: https://nodejs.org/');
      process.exit(1);
    }
    
    console.log(`✅ Node.js version: ${version}`);
  } catch (error) {
    console.log('❌ Node.js is not installed or not in PATH');
    process.exit(1);
  }
}

async function installDependencies() {
  console.log('\n📦 Installing dependencies...');
  
  try {
    const { stdout, stderr } = await execAsync('npm install');
    if (stderr && !stderr.includes('npm WARN')) {
      console.log('⚠️ Installation warnings:', stderr);
    }
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.log('❌ Failed to install dependencies:', error.message);
    console.log('Please run "npm install" manually');
  }
}

async function createEnvironmentFile() {
  console.log('\n🔧 Setting up environment configuration...');
  
  const envPath = '.env';
  const envExamplePath = 'env.example';
  
  if (await fs.pathExists(envPath)) {
    const overwrite = await question('Environment file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Keeping existing environment file');
      return;
    }
  }
  
  console.log('\n🔑 OpenAI API Key Setup');
  console.log('You need an OpenAI API key to use this application.');
  console.log('Get one at: https://platform.openai.com/api-keys\n');
  
  const apiKey = await question('Enter your OpenAI API key (or press Enter to skip): ');
  
  let envContent = '';
  
  if (await fs.pathExists(envExamplePath)) {
    envContent = await fs.readFile(envExamplePath, 'utf8');
    if (apiKey.trim()) {
      envContent = envContent.replace('your_openai_api_key_here', apiKey.trim());
    }
  } else {
    envContent = `# OpenAI Configuration
OPENAI_API_KEY=${apiKey.trim() || 'your_openai_api_key_here'}

# Server Configuration
PORT=3000
NODE_ENV=development

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Agent Configuration
DEFAULT_MODEL=gpt-3.5-turbo
MAX_TOKENS=1000
TEMPERATURE=0.7

# Web Search Configuration (Optional)
BING_SEARCH_API_KEY=your_bing_search_key_here
GOOGLE_SEARCH_API_KEY=your_google_search_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
`;
  }
  
  await fs.writeFile(envPath, envContent);
  console.log('✅ Environment file created');
  
  if (!apiKey.trim()) {
    console.log('⚠️ Remember to add your OpenAI API key to the .env file');
  }
}

async function createDirectories() {
  console.log('\n📁 Creating necessary directories...');
  
  const directories = ['uploads', 'logs'];
  
  for (const dir of directories) {
    await fs.ensureDir(dir);
    console.log(`✅ Created directory: ${dir}`);
  }
}

async function runTests() {
  console.log('\n🧪 Running tests...');
  
  const runTests = await question('Run test suite to verify installation? (Y/n): ');
  if (runTests.toLowerCase() === 'n') {
    console.log('⏭️ Skipping tests');
    return;
  }
  
  try {
    console.log('Running tests...');
    const { stdout } = await execAsync('npm test');
    console.log('✅ Tests completed successfully');
  } catch (error) {
    console.log('⚠️ Some tests may have failed (this is normal if OpenAI API key is not set)');
    console.log('You can run tests later with: npm test');
  }
}

async function showNextSteps() {
  console.log('\n🎉 Installation Complete!');
  console.log('========================\n');
  
  console.log('Next steps:');
  console.log('1. 🔑 Add your OpenAI API key to the .env file (if you haven\'t already)');
  console.log('2. 🚀 Start the server: npm start');
  console.log('3. 🌐 Visit: http://localhost:3000');
  console.log('4. 📚 Check the README.md for detailed documentation');
  console.log('5. 🧪 Run tests: npm test');
  
  console.log('\n🔗 Useful commands:');
  console.log('• npm start          - Start the server');
  console.log('• npm run dev        - Start with auto-reload');
  console.log('• npm test           - Run test suite');
  
  console.log('\n📖 Example usage:');
  console.log('curl -X POST http://localhost:3000/api/chat \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"message": "Hello, AI agent!"}\'');
  
  console.log('\n🤖 Happy building with AI Agents SDK!');
}

async function main() {
  try {
    await checkNodeVersion();
    await installDependencies();
    await createEnvironmentFile();
    await createDirectories();
    await runTests();
    await showNextSteps();
  } catch (error) {
    console.error('\n❌ Installation failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main(); 