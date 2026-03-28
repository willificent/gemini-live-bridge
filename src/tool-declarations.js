/**
 * Tool Declaration: Single "execute" function that routes all actions to OpenClaw
 * This abstracts the OpenClaw gateway as a single tool to Gemini
 */
module.exports = {
  functionDeclarations: [
    {
      name: 'execute',
      description: 'Execute a task through OpenClaw assistant. Use this for all user requests including memory search, messaging, file operations, web searches, calendar management, and any other capability.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Clear, concise description of what needs to be done. Be specific and include any relevant context from the conversation.'
          }
        },
        required: ['task']
      }
    }
  ]
};
