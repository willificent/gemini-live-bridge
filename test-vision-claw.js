#!/usr/bin/env node

/**
 * VisionClaw Integration Test Suite
 * Tests the audio pipeline with Gemini Live API and OpenClaw
 */

require('dotenv').config();
const { VisionClaw } = require('./src/vision-claw/vision-claw');

async function runTests() {
  console.log('🚀 VisionClaw Integration Tests\n');
  
  // Check environment
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in .env file');
    console.log('Create .env with: GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  const visionClaw = new VisionClaw({
    gemini: { debug: true },
    openclaw: { debug: true },
    audio: { debug: true }
  });

  // Test 1: Gemini Connection
  console.log('📋 Test 1: Gemini API Connection');
  try {
    await visionClaw.geminiService.connect();
    console.log('✅ Connected to Gemini Live API');
    visionClaw.geminiService.disconnect();
  } catch (err) {
    console.error('❌ Gemini connection failed:', err.message);
    return;
  }

  // Test 2: OpenClaw Bridge
  console.log('\n📋 Test 2: OpenClaw Bridge Health Check');
  try {
    const healthy = await visionClaw.openClawBridge.healthCheck();
    if (healthy) {
      console.log('✅ OpenClaw gateway reachable');
    } else {
      console.warn('⚠️ OpenClaw gateway not reachable (tool calls will fail)');
    }
  } catch (err) {
    console.warn('⚠️ OpenClaw bridge test failed:', err.message);
  }

  // Test 3: Audio Pipeline
  console.log('\n📋 Test 3: Audio Pipeline Initialization');
  try {
    await visionClaw.audioManager.initInput();
    await visionClaw.audioManager.initOutput();
    console.log('✅ Audio system initialized');
    visionClaw.audioManager.cleanup();
  } catch (err) {
    console.error('❌ Audio initialization failed:', err.message);
    return;
  }

  console.log('\n✅ All basic tests passed!');
  console.log('\n📋 Ready for manual testing:');
  console.log('1. Set up your .env file with required keys');
  console.log('2. Start OpenClaw gateway: openclaw gateway start');
  console.log('3. Run with: node vision-claw.js');
  console.log('\nOr run this script with --live flag for interactive session:');
  console.log('  node test-vision-claw.js --live');
}

async function runLiveTest() {
  console.log('🎙️ Starting Live Audio Session\n');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  const visionClaw = new VisionClaw({
    gemini: { 
      debug: process.env.DEBUG === 'true',
      apiKey: process.env.GEMINI_API_KEY 
    },
    openclaw: { 
      debug: process.env.DEBUG === 'true',
      url: process.env.OPENCLAW_GATEWAY_URL,
      token: process.env.OPENCLAW_GATEWAY_TOKEN
    }
  });

  try {
    await visionClaw.startAudioSession();
    console.log('\n🎤 Speak now! (Press Ctrl+C to exit)');
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping...');
      await visionClaw.stopAudioSession();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  } catch (err) {
    console.error('❌ Live session failed:', err);
    process.exit(1);
  }
}

// CLI handling
const args = process.argv.slice(2);
if (args.includes('--live')) {
  runLiveTest().catch(console.error);
} else {
  runTests().catch(console.error);
}