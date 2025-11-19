import winston from 'winston';
import config from './environment';

// Utility function to safely handle circular references
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Optionally exclude known problematic properties from network requests
    if (key === 'agent' || key === 'sockets' || key === '_httpMessage') {
        return undefined;
    }
    return value;
  };
};

// Custom format to safely process the error object before JSON serialization
const jsonSafeFormat = winston.format((info) => {
    // If we have metadata or a stack trace, attempt to clean it
    if (info.meta || info.stack) {
        // Use the safe replacer to stringify and parse back the object,
        // which effectively breaks all circular references without crashing.
        try {
            const safeInfo = JSON.parse(JSON.stringify(info, getCircularReplacer()));
            // Copy properties back to the original info object for the next formatters
            Object.assign(info, safeInfo);
        } catch (e) {
            // Should not happen, but a safeguard
            info.circularError = 'Failed to clean circular structure';
        }
    }
    
    return info;
});

// The format used by default (and for file logging in production)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  jsonSafeFormat(), // <-- Clean circular references here
  winston.format.json()
);

// The format used by the Console transport
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Applying the circular replacer to safely stringify metadata
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, getCircularReplacer(), 2)
      : '';
      
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// --- CORRECTED LOGGER INITIALIZATION ---
export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat, 
  defaultMeta: { service: 'contentai-api' },
  // Console transport is always active
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Add file transports only in production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export default logger;