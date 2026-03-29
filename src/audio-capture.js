// Audio pipeline integration - connects AudioManager to Gemini Live API
// This is the main handler for audio streaming

const { AudioManager } = require('./vision-claw/audio-manager');
const { GeminiLiveService } = require('./vision-claw/gemini-live-service');
const { OpenClawBridge } = require('./vision-claw/openclaw-bridge');

class AudioCapture {
  constructor(config = {}) {
    this.audioManager = new AudioManager(config.audio);
    this.geminiClient = new GeminiLiveService(config.gemini);
    this.openClawBridge = new OpenClawBridge(config.openclaw);
    
    this.isRunning = false;
    this.onTranscript = null;
    this.onToolCall = null;
  }

  async initialize() {
    await this.audioManager.initInput();
    await this.audioManager.initOutput();
    
    // Connect Gemini client with tool call handler
    this.geminiClient.onToolCall = async (toolCall) => {
      console.log('🔧 Tool call received:', toolCall);
      if (this.onToolCall) {
        await this.onToolCall(toolCall);
      } else {
        await this.handleDefaultToolCall(toolCall);
      }
    };

    this.geminiClient.onTextReceived = (text) => {
      if (this.onTranscript) {
        this.onTranscript(text);
      }
    };
  }

  async start() {
    if (this.isRunning) return;

    // Connect to Gemini
    await this.geminiClient.connect();

    // Start audio capture and stream to Gemini
    this.audioManager.onData = async (buffer) => {
      try {
        const base64Audio = buffer.toString('base64');
        await this.geminiClient.sendAudio(base64Audio);
      } catch (err) {
        console.error('Failed to send audio to Gemini:', err);
      }
    };

    await this.audioManager.startRecording();
    this.isRunning = true;
    console.log('🎤 Audio capture started');
  }

  async stop() {
    if (!this.isRunning) return;
    
    await this.audioManager.stopRecording();
    this.geminiClient.disconnect();
    this.isRunning = false;
    console.log('🛑 Audio capture stopped');
  }

  async handleDefaultToolCall(toolCall) {
    for (const call of toolCall.functionCalls) {
      if (call.name === 'execute') {
        const task = call.args?.task || JSON.stringify(call.args);
        try {
          console.log(`🔨 Executing task: ${task.substring(0, 100)}...`);
          const result = await this.openClawBridge.executeTask(task);
          
          this.geminiClient.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result }
            }]
          });
        } catch (err) {
          console.error('Task execution failed:', err);
          this.geminiClient.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result: `Error: ${err.message}` }
            }]
          });
        }
      }
    }
  }

  cleanup() {
    this.audioManager.cleanup();
    this.geminiClient.disconnect();
  }
}

module.exports = { AudioCapture };