import { Config } from '../types/index.ts';

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
    // Validate agents exist
    if (!config.agents || Object.keys(config.agents).length === 0) {
      throw new Error('Config must have at least one agent defined');
    }
    
    // Validate teams exist
    if (!config.teams || Object.keys(config.teams).length === 0) {
      throw new Error('Config must have at least one team defined');
    }
    
    // Validate team agents reference existing agents
    for (const [teamId, team] of Object.entries(config.teams)) {
      for (const agentId of team.agents) {
        if (!config.agents[agentId]) {
          throw new Error(`Team ${teamId} references unknown agent: ${agentId}`);
        }
      }
    }
    
    // Validate agent teams reference existing teams
    for (const [agentId, agent] of Object.entries(config.agents)) {
      for (const teamId of agent.teams) {
        if (!config.teams[teamId]) {
          throw new Error(`Agent ${agentId} references unknown team: ${teamId}`);
        }
      }
    }
    
    // Validate models
    if (!config.models || Object.keys(config.models).length === 0) {
      throw new Error('Config must have at least one model defined');
    }
    
    // Validate pipeline stages reference valid models
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
