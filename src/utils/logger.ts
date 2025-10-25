// src/utils/logger.ts
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "");
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : "");
  },
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data) : "");
  },
  debug: (message: string, data?: any) => {
    console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data) : "");
  },
};

export default logger;