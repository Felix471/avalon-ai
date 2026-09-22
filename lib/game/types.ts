// ==================== 基础枚举 ====================

export type Team = 'good' | 'evil';

export type RoleType =
  | 'merlin'      // 梅林 - 知道坏人（除莫德雷德）
  | 'percival'    // 派西维尔 - 知道梅林和莫甘娜
  | 'loyal'       // 忠臣 - 普通好人
  | 'assassin'    // 刺客 - 可刺杀梅林
  | 'morgana'     // 莫甘娜 - 伪装梅林
  | 'mordred'     // 莫德雷德 - 梅林看不到
  | 'oberon'      // 奥伯伦 - 双向隐身
  | 'minion';     // 爪牙 - 普通坏人

export type GamePhase =
  | 'lobby'           // 大厅设置
  | 'role_reveal'     // 角色揭示
  | 'discussion'      // 讨论阶段
  | 'team_building'   // 队长组队
  | 'team_vote'       // 投票表决
  | 'quest'           // 执行任务
  | 'assassination'   // 刺杀阶段
  | 'game_over';      // 游戏结束

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'xai';

// ==================== 角色信息 ====================

export interface RoleInfo {
  type: RoleType;
  name: string;
  team: Team;
  description: string;
  emoji: string;
}

export const ROLES: Record<RoleType, RoleInfo> = {
  merlin: {
    type: 'merlin',
    name: '梅林',
    team: 'good',
    description: '你能看到所有邪恶阵营成员（除了莫德雷德），但要隐藏身份避免被刺客识破',
    emoji: '🧙'
  },
  percival: {
    type: 'percival',
    name: '派西维尔',
    team: 'good',
    description: '你能看到梅林和莫甘娜，但不知道谁是真正的梅林',
    emoji: '🛡️'
  },
  loyal: {
    type: 'loyal',
    name: '忠臣',
    team: 'good',
    description: '你是亚瑟的忠诚仆人，没有特殊能力，需要通过推理找出坏人',
    emoji: '⚔️'
  },
  assassin: {
    type: 'assassin',
    name: '刺客',
    team: 'evil',
    description: '游戏结束时如果好人获胜，你可以刺杀梅林来逆转胜负',
    emoji: '🗡️'
  },
  morgana: {
    type: 'morgana',
    name: '莫甘娜',
    team: 'evil',
    description: '你在派西维尔眼中看起来像梅林，要利用这点误导好人',
    emoji: '🦹'
  },
  mordred: {
    type: 'mordred',
    name: '莫德雷德',
    team: 'evil',
    description: '梅林看不到你，你是隐藏最深的邪恶势力',
    emoji: '👤'
  },
  oberon: {
    type: 'oberon',
    name: '奥伯伦',
    team: 'evil',
    description: '你不知道其他坏人是谁，他们也不知道你',
    emoji: '👻'
  },
  minion: {
    type: 'minion',
    name: '爪牙',
    team: 'evil',
    description: '你知道谁是邪恶阵营同伴，配合他们破坏任务',
    emoji: '😈'
  }
};

// ==================== AI模型配置（根据实际 API 修正） ====================

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  color: string;
}

// These are the model strings the web app calls today; the dataset in data/games.jsonl was collected with the April-2026 strings recorded in analysis/config_map.md.
export const AI_MODELS: AIModel[] = [
  // Anthropic
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    color: '#D97706'
  },

  // OpenAI
  {
    id: 'gpt',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    model: 'gpt-5.4-mini',
    color: '#10A37F'
  },

  // Google
  {
    id: 'gemini-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'google',
    model: 'gemini-3.8-flash',
    color: '#4285F4'
  },

  // DeepSeek
  {
    id: 'deepseek',
    name: 'DeepSeek V4.1 Flash',
    provider: 'deepseek',
    model: 'deepseek-flash',
    color: '#0066FF'
  },

  // xAI - Grok
  {
    id: 'grok',
    name: 'Grok 4.3 (non-reasoning)',
    provider: 'xai',
    model: 'grok-4.3',
    color: '#1DA1F2'
  },
];

// ==================== 玩家 ====================

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  role?: RoleType;
  aiModel?: AIModel;
}

// ==================== 任务 ====================

export interface Quest {
  questNumber: number;
  requiredPlayers: number;
  requiresDoubleFail: boolean;
  team?: number[];
  votes?: Record<number, boolean>;
  actions?: Record<number, boolean>;
  result?: 'success' | 'fail' | 'pending';
}

// ==================== 游戏事件 ====================

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'discussion' | 'assassination' | 'vote' | 'vote_result' | 'quest_action' | 'quest_result' | 'team_proposal' | 'system';
  playerId?: number;
  playerName?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ==================== 变体规则 ====================

export interface VariantRules {
  assassinAnytime: boolean;
  discussionMode: 'first_only' | 'every_time';
  fifthVoteRule: 'auto_fail' | 'force_team' | 'evil_wins';
}

export interface SeatConfig {
  modelId: string;
}

export interface GenerationSettings {
  temperature?: number;
  /** Explicit output cap for every action. Undefined = per-action default (DEFAULT_MAX_TOKENS). */
  maxTokens?: number;
}

export const DEFAULT_GENERATION: GenerationSettings = {};

/** Per-action output caps used when the player has not set maxTokens. */
export const DEFAULT_MAX_TOKENS = { discussion: 600, other: 300 } as const;

/** Actions whose whole answer is one verdict word or a few ids. */
export const VERDICT_ACTIONS = new Set(['voting', 'quest', 'assassination']);

export function resolveMaxTokens(action: string, generation?: GenerationSettings): number {
  if (generation?.maxTokens !== undefined) return generation.maxTokens;
  return action === 'discussion' ? DEFAULT_MAX_TOKENS.discussion : DEFAULT_MAX_TOKENS.other;
}

export const GENERATION_LIMITS = {
  temperature: { min: 0, max: 1.5, step: 0.1 },
  maxTokens: { min: 100, max: 1500 },
} as const;

// ==================== 游戏状态 ====================

export interface GameState {
  gameId: string;
  playerCount: number;
  phase: GamePhase;
  variantRules: VariantRules;
  players: Player[];
  humanPlayerId: number;
  currentLeaderIndex: number;
  currentQuest: number;
  quests: Quest[];
  consecutiveRejects: number;
  hasDiscussedThisQuest: boolean;
  goodWins: number;
  evilWins: number;
  winner?: Team;
  assassinationTarget?: number;
  events: GameEvent[];
  currentProposedTeam?: number[];
  currentVotes?: Record<number, boolean>;
  discussionRound?: number;
  discussionRounds?: number;
  promptMode: 'full' | 'naive';
  generation: GenerationSettings;
}

// ==================== 游戏配置 ====================

export interface GameConfig {
  playerCount: number;
  enabledModels: string[];
  seats: SeatConfig[];
  generation: GenerationSettings;
  promptMode: 'full' | 'naive';
  quickMode: boolean;
  roles: RoleType[];
  questSizes: number[];
  variantRules: VariantRules;
}

// Matches the discussion-round count used by the batch collection setting.
export const DISCUSSION_ROUNDS = 2;

export const ROLE_CONFIGS: Record<number, RoleType[]> = {
  5: ['merlin', 'percival', 'loyal', 'assassin', 'morgana'],
  6: ['merlin', 'percival', 'loyal', 'loyal', 'assassin', 'morgana'],
  7: ['merlin', 'percival', 'loyal', 'loyal', 'assassin', 'morgana', 'minion'],
  8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'minion'],
  9: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred'],
  10: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon'],
};

export const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export const DOUBLE_FAIL_QUESTS: Record<number, number[]> = {
  7: [4],
  8: [4],
  9: [4],
  10: [4],
};
