#!/usr/bin/env node
require('dotenv').config();
const OpenClawBridge = require('./openclaw-bridge');
const GeminiLiveClient = require('./gemini-client');

async function main() {
  console.log('🚀 Starting Gemini Live Bridge...');

  if (process.argv.includes('--voice') || process.argv.includes('--mock')) {
    const bridge = new OpenClawBridge();
    try {
      await bridge.healthCheck();
      console.log('✅ Gateway reachable!');
    } catch (error) {
      console.error('❌ Failed to connect to OpenClaw gateway:', error.message);
      console.error('Check that the gateway is running and credentials are correct.');
      process.exit(1);
    }
  }

  const voiceMode = process.argv.includes('--voice');
  const mockMode = process.argv.includes('--mock');

  if (voiceMode || mockMode) {
    console.log('🎤 Starting Gemini Live Bridge in Voice Mode...');
    const client = new GeminiLiveClient({ mockMode });
    await client.connect();
  } else {
    console.log('🔧 Starting Gemini Live Bridge (Text Test Mode)');
    console.log('This mode sends text directly to OpenClaw gateway (bypassing Gemini).');
    console.log('Enter your task/query and press Enter. Type "exit" or Ctrl+C to quit.\n');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const bridge = new OpenClawBridge();

    rl.setPrompt('📝 Task: ');
    rl.prompt();

    rl.on('line', async (input) => {
      if (input.trim().toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      try {
        console.log('⏳ Sending to OpenClaw gateway...');
        const response = await bridge.sendToOpenClaw(input);
        console.log('🤖 Response:\n' + response + '\n');
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
