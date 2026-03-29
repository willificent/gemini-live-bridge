#!/usr/bin/env node

/**
 * Test script for Gemini Live Bridge using official SDK
 */

require('dotenv').config();
const { GeminiLiveBridge } = require('./src/index');

async function runLiveSession() {
  console.log('🤖 Gemini Live Bridge Test\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in .env');
    process.exit(1);
  }

  const bridge = new GeminiLiveBridge();

  // Setup callbacks
  bridge.onAudioReceived = (base64Audio) => {
    console.log(`🔊 Received audio response (${base64Audio.length} chars)`);
  };

  bridge.onTextReceived = (text) => {
    console.log(`💬 Gemini: ${text}`);
  };

  bridge.onToolCall = async (toolCall) => {
    console.log('🔧 Tool call:', toolCall);
    // Default handling will execute via OpenClaw
  };

  bridge.onError = (err) => {
    console.error('❌ Error:', err);
  };

  bridge.onClose = () => {
    console.log('🔌 Session closed');
  };

  try {
    // Initialize audio
    await bridge.initializeAudio();
    
    // Connect to Gemini
    await bridge.connect();
    
    // Start audio streaming
    await bridge.startAudioStream();
    
    console.log('\n🎤 Speak now! (Press Ctrl+C to exit)\n');
    
    // Keep running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await bridge.stop();
      process.exit(0);
    });
    
    await new Promise(() => {}); // Keep alive
  } catch (err) {
    console.error('❌ Failed to start session:', err);
    process.exit(1);
  }
}

runLiveSession().catch(console.error);