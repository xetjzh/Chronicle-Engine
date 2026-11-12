import type { AIProviderConfig } from '../types';

export function isGLM53Model(model: string): boolean {
  return model.trim().toLowerCase().split('/').pop() === 'glm-5.3';
}

export function compatibleRequestPolicy(config: AIProviderConfig['openaiCompatible']) {
  const glm53 = isGLM53Model(config.model);
  return {
    glm53,
    reasoningEffort: glm53 ? config.reasoningEffort ?? 'low' : undefined,
    timeoutSeconds: config.requestTimeoutSeconds ?? (glm53 ? 300 : 90),
  };
}
