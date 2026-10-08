const { config } = require('../config/index.js');

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = levels[config.logLevel] !== undefined ? levels[config.logLevel] : 1;

const logger = {
  debug: (...args) => {
    if (currentLevel <= 0) console.log(new Date().toISOString(), '[DEBUG]', ...args);
  },
  info: (...args) => {
    if (currentLevel <= 1) console.log(new Date().toISOString(), '[INFO]', ...args);
  },
  warn: (...args) => {
    if (currentLevel <= 2) console.warn(new Date().toISOString(), '[WARN]', ...args);
  },
  error: (...args) => {
    if (currentLevel <= 3) console.error(new Date().toISOString(), '[ERROR]', ...args);
  }
};

module.exports = { logger };
