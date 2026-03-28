// src/tool-router.js
// Routes tool calls from Gemini to OpenClaw and sends responses back

class ToolRouter {
  constructor(openClawBridge) {
    this.openClawBridge = openClawBridge;
  }

  async handleToolCall(msg, ws) {
    const toolCall = msg.toolCall;
    if (!toolCall?.functionCalls) return;

    for (const call of toolCall.functionCalls) {
      const callId = call.id;
      const task = call.args?.task || JSON.stringify(call.args);
      console.log(`[ToolCall] ${call.name}(${callId}): ${task.substring(0, 100)}...`);
      try {
        const result = await this.openClawBridge.sendToOpenClaw(task);
        const response = {
          toolResponse: {
            functionResponses: [{
              id: callId,
              name: call.name,
              response: { result }
            }]
          }
        };
        if (ws) ws.send(JSON.stringify(response));
      } catch (error) {
        const response = {
          toolResponse: {
            functionResponses: [{
              id: callId,
              name: call.name,
              response: { error: error.message }
            }]
          }
        };
        if (ws) ws.send(JSON.stringify(response));
      }
    }
  }
}

module.exports = ToolRouter;
