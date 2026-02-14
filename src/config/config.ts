import { Config } from '../types';

export class ConfigLoader {
  static async load(path: string): Promise<Config> {
    const file = Bun.file(path);
    
    if (!(await file.exists())) {
      throw new Error(`Config file not found: ${path}`);
    }
    
    const content = await file.text();
    const config = JSON.parse(content) as Config;
    
    // Validate required fields
    this.validate(config);
    
    // Expand environment variables
    return this.expandEnvVars(config);
  }
  
  private static validate(config: Config): void {
    if (!config.models || Object.keys(config.models).length === 0) {
      throw new Error('Config must have at least one model defined');
    }
    
    if (!config.pipeline) {
      throw new Error('Config must have pipeline configuration');
    }
    
    if (!config.costTracking) {
      throw new Error('Config must have costTracking configuration');
    }
    
    // Validate that pipeline models exist
    const modelNames = Object.keys(config.models);
    const stages = ['parse', 'decompose', 'clarify', 'execute'] as const;
    
    for (const stage of stages) {
      const stageConfig = config.pipeline[stage];
      if ('primary' in stageConfig) {
        if (!modelNames.includes(stageConfig.primary)) {
          throw new Error(`Pipeline stage ${stage} references unknown model: ${stageConfig.primary}`);
        }
        if (stageConfig.fallback && !modelNames.includes(stageConfig.fallback)) {
          throw new Error(`Pipeline stage ${stage} references unknown fallback model: ${stageConfig.fallback}`);
        }
      }
    }
  }
  
  private static expandEnvVars(config: Config): Config {
    const configStr = JSON.stringify(config);
    const expanded = configStr.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
    return JSON.parse(expanded);
  }
}
