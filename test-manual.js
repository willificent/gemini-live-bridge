#!/usr/bin/env node
// Test script for OpenClaw bridge
require('dotenv').config();
const OpenClawBridge = require('./src/openclaw-bridge');

async function test() {
  const bridge = new OpenClawBridge();
  
  console.log('🔧 Testing OpenClaw bridge...\n');
  
  try {
    // Test query
    const result = await bridge.execute("What is my name?");
    console.log('\n✅ Response from OpenClaw agent:\n');
    console.log(result);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

test();
