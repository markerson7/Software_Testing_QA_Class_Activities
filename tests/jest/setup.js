import dotenv from 'dotenv';
import { jest } from '@jest/globals';

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = '34iu13fn4u1m3r4t3k3y12s3';
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 's3cr3tR3fr3shT0k3y12wer3';
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}


if (!process.env.MONGODB_URL) {
  console.warn('Warning: No MongoDB URL found in environment variables');
}

// Global test timeout
jest.setTimeout(60000);


const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('MONGODB DRIVER')) {
    return; 
  }
  originalWarn.apply(console, args);
};