export class Logger {
  constructor(private context: string) {}
  
  info(message: string, meta?: Record<string, any>): void {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.context}] ${message}`, meta || '');
  }
  
  error(message: string, error?: any): void {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}] ${message}`, error || '');
  }
  
  warn(message: string, meta?: Record<string, any>): void {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}] ${message}`, meta || '');
  }
  
  debug(message: string, meta?: Record<string, any>): void {
    if (process.env.DEBUG) {
      console.log(`[${new Date().toISOString()}] [DEBUG] [${this.context}] ${message}`, meta || '');
    }
  }
}
