/**
 * Experimental configurations for the batch runner.
 * Four conditions defined by the research design (Lan et al. 2024 reproduction).
 */

import { AIModel, AI_MODELS } from '../lib/game/types';

export type PromptMode = 'full' | 'naive';

export interface BatchConfig {
  name: string;
  models: AIModel[];         // exactly 5 models for 5-player games
  promptMode: PromptMode;
}

// Helper to find a model by its id from AI_MODELS
function model(id: string): AIModel {
  const m = AI_MODELS.find(m => m.id === id);
  if (!m) throw new Error(`Model not found: ${id}`);
  return m;
}

const HETEROGENEOUS_MODELS: AIModel[] = [
  model('claude-sonnet'),
  model('gpt'),
  model('gemini-flash'),
  model('deepseek'),
  model('grok'),
];

export const CONFIGS: Record<string, BatchConfig> = {
  'heterogeneous-full': {
    name: 'heterogeneous-full',
    models: HETEROGENEOUS_MODELS,
    promptMode: 'full',
  },
  'homogeneous-gpt4o': {
    name: 'homogeneous-gpt4o',
    models: Array(5).fill(model('gpt')),
    promptMode: 'full',
  },
  'homogeneous-claude': {
    name: 'homogeneous-claude',
    models: Array(5).fill(model('claude-sonnet')),
    promptMode: 'full',
  },
  'heterogeneous-naive': {
    name: 'heterogeneous-naive',
    models: HETEROGENEOUS_MODELS,
    promptMode: 'naive',
  },
};

export const ALL_CONFIG_NAMES = Object.keys(CONFIGS);
