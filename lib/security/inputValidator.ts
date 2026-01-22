/**
 * 输入验证器 v2 - 防止 Prompt Injection 攻击（加强版）
 *
 * 更新内容：
 * - 新增 Base64 编码检测
 * - 新增 SQL 注入字符检测
 * - 新增社会工程关键词
 * - 新增紧急/权威伪装检测
 */

// ==================== 配置常量 ====================

export const MAX_SPEECH_LENGTH = 500;
export const MIN_SPEECH_LENGTH = 1;

// 可疑关键词列表 - 加强版
const SUSPICIOUS_PATTERNS = [
  // ========== 指令覆盖尝试 ==========
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /忽略(之前|以上|所有|全部)?(的)?(指令|提示|规则|设定)/i,
  /disregard\s+(all\s+)?(previous|above)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|prompts?)/i,
  /无视(之前|以上|所有)?(的)?(指令|规则)/i,

  // ========== 角色切换尝试 ==========
  /you\s+are\s+(now|no\s+longer)\s+(a|an)/i,
  /你(现在)?是(一个|一名)/i,
  /act\s+as\s+(a|an|if)/i,
  /pretend\s+(to\s+be|you('re)?)/i,
  /roleplay\s+as/i,
  /从现在开始你是/i,
  /扮演(一个|一名)/i,

  // ========== 系统提示词探测 ==========
  /system\s*prompt/i,
  /系统提示/i,
  /what\s+(are|is)\s+your\s+(instructions?|rules?|prompts?)/i,
  /show\s+me\s+your\s+(prompt|instructions?)/i,
  /repeat\s+(your\s+)?(system|initial)\s+(prompt|instructions?)/i,
  /输出.*提示词/i,
  /显示.*指令/i,
  /告诉我你的(指令|设定|提示)/i,

  // ========== 越狱相关词汇 ==========
  /jailbreak/i,
  /DAN\s*mode/i,
  /developer\s*mode/i,
  /无限制模式/i,
  /越狱/i,
  /解除限制/i,

  // ========== 代码执行尝试 ==========
  /```[\s\S]*```/,           // 代码块
  /<script/i,                 // XSS
  /eval\s*\(/i,
  /exec\s*\(/i,
  /import\s+os/i,
  /require\s*\(/i,

  // ========== 试图结束对话或重置 ==========
  /\[end\]/i,
  /\[reset\]/i,
  /\[system\]/i,
  /<<SYS>>/i,
  /\[INST\]/i,
  /<<API/i,
  /<<END/i,
  /<\/?INST>/i,

  // ========== 新增：Base64 编码检测 ==========
  /base64/i,
  /请解码/i,
  /decode\s+(and|this)/i,
  /aWdub3Jl/i,                // "ignore" 的 Base64 开头
  /cHJvbXB0/i,                // "prompt" 的 Base64

  // ========== 新增：SQL 注入风格 ==========
  /'\s*;\s*drop\s+table/i,
  /'\s*;\s*delete\s+from/i,
  /'\s*or\s+'1'\s*=\s*'1/i,
  /union\s+select/i,
  /--\s*$/m,                  // SQL 注释结尾

  // ========== 新增：社会工程 / 权威伪装 ==========
  /我是.*(员工|开发者|管理员|工程师)/i,
  /i('m| am)\s+(a|an|the)\s*(employee|developer|admin|engineer)/i,
  /紧急情况/i,
  /emergency/i,
  /urgent.*request/i,
  /this is urgent/i,
  /anthropic.*(员工|staff|employee)/i,
  /openai.*(员工|staff|employee)/i,
  /系统出了问题/i,
  /system\s*(error|problem|issue)/i,
  /立即输出/i,
  /immediately\s+(output|show|display)/i,
  /用于(调试|修复|检查)/i,
  /for\s+(debug|debugging|testing|repair)/i,

  // ========== 新增：隐藏指令标记 ==========
  /\[hidden/i,
  /\[secret/i,
  /\[private/i,
  /hidden\s*instruction/i,
  /secret\s*command/i,

  // ========== 新增：翻译/帮忙请求（脱离游戏） ==========
  /帮我(翻译|写|做|完成)/i,
  /help\s+me\s+(translate|write|do|complete)/i,
  /翻译.*[：:]/i,
  /translate.*[：:]/i,
  /写一篇/i,
  /write\s+(me\s+)?(a|an)\s+(essay|article|story|code)/i,
];

// 需要转义的特殊字符
const SPECIAL_CHARS_TO_ESCAPE = [
  { pattern: /\[/g, replacement: '［' },
  { pattern: /\]/g, replacement: '］' },
  { pattern: /\{/g, replacement: '｛' },
  { pattern: /\}/g, replacement: '｝' },
  { pattern: /<</g, replacement: '《' },
  { pattern: />>/g, replacement: '》' },
  { pattern: /`/g, replacement: '"' },      // 反引号转弯引号
  { pattern: /;(\s*)--/g, replacement: '；$1——' }, // SQL 注释转中文
];

// ==================== 验证结果类型 ====================

export interface ValidationResult {
  isValid: boolean;
  sanitizedInput: string;
  warnings: string[];
  rejectionReason?: string;
}

// ==================== 核心验证函数 ====================

/**
 * 验证并清理用户的发言输入
 */
export function validateSpeechInput(input: string): ValidationResult {
  const warnings: string[] = [];
  let sanitized = input.trim();

  // 检查 1: 空白检查
  if (sanitized.length === 0) {
    return {
      isValid: false,
      sanitizedInput: '',
      warnings: [],
      rejectionReason: '发言内容不能为空',
    };
  }

  // 检查 2: 长度检查
  if (sanitized.length > MAX_SPEECH_LENGTH) {
    return {
      isValid: false,
      sanitizedInput: '',
      warnings: [],
      rejectionReason: `发言内容过长，最多 ${MAX_SPEECH_LENGTH} 字`,
    };
  }

  // 检查 3: 可疑模式检测（核心防护）
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      // 记录被拦截的内容（用于后续分析）
      console.warn('[INPUT_BLOCKED]', {
        pattern: pattern.toString(),
        input: sanitized.substring(0, 50),
      });

      return {
        isValid: false,
        sanitizedInput: '',
        warnings: [],
        rejectionReason: '发言内容包含不允许的格式',
      };
    }
  }

  // 检查 4: 检测可疑的长 Base64 字符串
  const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
  const base64Matches = sanitized.match(base64Pattern);
  if (base64Matches && base64Matches.some(m => m.length > 30)) {
    return {
      isValid: false,
      sanitizedInput: '',
      warnings: [],
      rejectionReason: '发言内容包含可疑编码',
    };
  }

  // 检查 5: 特殊字符转义
  for (const { pattern, replacement } of SPECIAL_CHARS_TO_ESCAPE) {
    if (pattern.test(sanitized)) {
      warnings.push('部分特殊字符已被转换');
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  // 检查 6: 移除多余空白（但保留换行）
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n'); // 最多两个换行

  // 检查 7: 检测异常的重复字符
  const repeatedCharPattern = /(.)\1{15,}/;
  if (repeatedCharPattern.test(sanitized)) {
    return {
      isValid: false,
      sanitizedInput: '',
      warnings: [],
      rejectionReason: '发言内容包含异常重复字符',
    };
  }

  // 检查 8: 检测过多的特殊符号（可能是编码攻击）
  const specialCharCount = (sanitized.match(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？、：；""''（）]/g) || []).length;
  const specialCharRatio = specialCharCount / sanitized.length;
  if (specialCharRatio > 0.3 && sanitized.length > 20) {
    warnings.push('特殊字符比例较高');
  }

  return {
    isValid: true,
    sanitizedInput: sanitized,
    warnings,
  };
}

/**
 * 快速检查输入是否可疑（轻量版，用于前端实时检查）
 */
export function quickSuspicionCheck(input: string): boolean {
  if (input.length > MAX_SPEECH_LENGTH) return true;

  // 快速检测最常见的攻击模式
  const quickPatterns = [
    /ignore.*instruction/i,
    /忽略.*指令/i,
    /you are now/i,
    /你现在是/i,
    /system\s*prompt/i,
    /帮我(翻译|写)/i,
    /紧急情况/i,
    /我是.*员工/i,
    /base64/i,
    /请解码/i,
  ];

  return quickPatterns.some(p => p.test(input));
}

/**
 * 为 AI 调用准备安全的用户输入
 */
export function wrapUserInputForAI(input: string, playerId: number): string {
  const validated = validateSpeechInput(input);

  if (!validated.isValid) {
    return `[玩家${playerId}的发言被过滤]`;
  }

  // 用中文引号包裹，明确这是用户输入
  return `「${validated.sanitizedInput}」`;
}

/**
 * 检查是否包含疑似编码内容
 */
export function containsEncodedContent(input: string): boolean {
  // Base64 特征
  const base64Pattern = /[A-Za-z0-9+/]{30,}={0,2}/;
  if (base64Pattern.test(input)) return true;

  // Hex 编码特征
  const hexPattern = /(?:0x)?[0-9a-fA-F]{20,}/;
  if (hexPattern.test(input)) return true;

  // URL 编码特征
  const urlEncodedPattern = /%[0-9a-fA-F]{2}.*%[0-9a-fA-F]{2}.*%[0-9a-fA-F]{2}/;
  if (urlEncodedPattern.test(input)) return true;

  return false;
}