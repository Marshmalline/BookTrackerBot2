
// Debug utility for SapphFIC Discord Bot

const fs = require('fs');
const path = require('path');

// Create a logs directory if it doesn't exist
const LOGS_DIR = 'logs';
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// Logger function that can be used in the main bot file
function logMessage(message, userId, commandType) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] User ${userId} executed ${commandType}: ${message}\n`;
  
  const logFile = path.join(LOGS_DIR, `bot_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logLine);
}

// Export the logger
module.exports = {
  logMessage
};

// You can import this in SapphFIC.js with:
// const debug = require('./debug.js');
// Then use: debug.logMessage(message.content, message.author.id, 'profile');
