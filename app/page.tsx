'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, useHydration } from '@/lib/game/store';
import { AI_MODELS } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Users, Play, Bot, Info, AlertTriangle, Heart, Lock, Sparkles
} from 'lucide-react';

// ==================== 验证组件 ====================

function AuthGate({ onVerified }: { onVerified: () => void }) {
  const [chineseName, setChineseName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    // 硬编码验证
    const isCorrect =
      chineseName.trim() === '王梓宜' &&
      englishName.trim().toLowerCase() === 'felix';

    if (isCorrect) {
      // 存储验证状态到 sessionStorage（关闭浏览器后失效）
      sessionStorage.setItem('avalon_verified', 'true');
      onVerified();
    } else {
      setError('答案不正确，请联系作者获取正确答案 😅');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div
        className={`
          bg-slate-800/80 rounded-2xl border border-slate-700 p-8 max-w-md w-full
          shadow-2xl backdrop-blur-sm
          ${shake ? 'animate-shake' : ''}
        `}
      >
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏰</div>
          <h1 className="text-2xl font-bold text-amber-400 mb-2">AI 阿瓦隆</h1>
          <p className="text-slate-400 text-sm">请回答以下问题以验证身份</p>
        </div>

        {/* 验证表单 */}
        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              作者的中文名是？
            </label>
            <Input
              value={chineseName}
              onChange={(e) => setChineseName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入中文名"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              作者的英文名是？
            </label>
            <Input
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入英文名"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full bg-amber-600 hover:bg-amber-500"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            验证身份
          </Button>
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-slate-500 text-xs">
          如果你不知道答案，说明你可能不是目标用户 🤔
        </div>
      </div>

      {/* shake 动画的 CSS */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

// ==================== 大厅主组件 ====================

function LobbyContent() {
  const router = useRouter();
  const { config, updateConfig, startGame } = useGameStore();

  const handlePlayerCountChange = (count: number) => {
    updateConfig({ playerCount: count });
  };

  const handleModelToggle = (modelId: string) => {
    const newModels = config.enabledModels.includes(modelId)
      ? config.enabledModels.filter(id => id !== modelId)
      : [...config.enabledModels, modelId];
    updateConfig({ enabledModels: newModels });
  };

  const handleVariantChange = (key: string, value: any) => {
    updateConfig({
      variantRules: { ...config.variantRules, [key]: value }
    });
  };

  const handleStartGame = () => {
    // 至少需要2个模型（可以复用同一个模型扮演多个角色）
    if (config.enabledModels.length < 2) {
      alert('请至少选择 2 个 AI 模型');
      return;
    }
    startGame();
    router.push('/game');
  };

  const playerCounts = [5, 6, 7, 8, 9, 10];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">🏰 AI 阿瓦隆</h1>
          <p className="text-slate-400">与多个 AI 模型一起玩阿瓦隆桌游</p>
        </div>

        {/* API 付费提示 */}
        <div className="mb-6 p-4 bg-gradient-to-r from-pink-900/30 to-purple-900/30 rounded-xl border border-pink-500/30">
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <span className="text-pink-400 font-medium">温馨提示 💕</span>
              <p className="mt-1">
                目前游戏中的大模型 API 调用费用由作者个人承担，为了让这个小项目能持续运营，
                请不要将链接分享到面向不特定公众的平台（如小红书、微博、微信群等）。
                如果想分享给现实中的朋友，请先征得作者同意哦~ 感谢理解！🙏✨
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左侧：玩家人数 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              玩家人数
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {playerCounts.map(count => (
                <button
                  key={count}
                  onClick={() => handlePlayerCountChange(count)}
                  className={`
                    py-3 px-4 rounded-lg font-medium transition-all
                    ${config.playerCount === count
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }
                  `}
                >
                  {count} 人
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-sm mt-3">
              你将作为其中一名玩家参与游戏
            </p>
          </div>

          {/* 右侧：AI 模型选择 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              AI 模型
            </h2>
            <div className="space-y-2">
              {AI_MODELS.map(model => (
                <label
                  key={model.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                    ${config.enabledModels.includes(model.id)
                      ? 'bg-slate-700'
                      : 'bg-slate-800/50 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <Checkbox
                    checked={config.enabledModels.includes(model.id)}
                    onCheckedChange={() => handleModelToggle(model.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="text-white flex-1">{model.name}</span>
                  {/* Gemini Pro 慢速提示 */}
                  {model.id === 'gemini-pro' && (
                    <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">
                      ⏳ 较慢
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-slate-500 text-sm mt-3">
              至少选择 2 个模型（可复用扮演多个角色）
            </p>
          </div>
        </div>

        {/* 变体规则 */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-400" />
            游戏规则变体
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {/* 刺客规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">刺客开刀时机</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={!config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', false)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">好人3胜后开刀</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', true)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">随时可开刀</span>
                </label>
              </div>
            </div>

            {/* 发言规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">发言阶段</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'every_time'}
                    onChange={() => handleVariantChange('discussionMode', 'every_time')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">每次组队前发言</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'first_only'}
                    onChange={() => handleVariantChange('discussionMode', 'first_only')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">仅首次组队前发言</span>
                </label>
              </div>
            </div>

            {/* 第五次投票规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">连续5次否决</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'force_team'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'force_team')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">第5次强制发车</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'evil_wins'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'evil_wins')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">坏人直接获胜</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 开始游戏按钮 */}
        <div className="mt-6 text-center">
          <Button
            onClick={handleStartGame}
            size="lg"
            className="bg-amber-600 hover:bg-amber-500 text-lg px-8 py-6"
          >
            <Play className="w-5 h-5 mr-2" />
            开始游戏
          </Button>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Made with ❤️ by Felix</p>
        </div>
      </div>
    </div>
  );
}

// ==================== 主页面（包含验证逻辑） ====================

export default function HomePage() {
  const hydrated = useHydration();
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 检查是否已验证
    if (typeof window !== 'undefined') {
      const verified = sessionStorage.getItem('avalon_verified') === 'true';
      setIsVerified(verified);
      setIsChecking(false);
    }
  }, []);

  // 等待 hydration 和验证检查
  if (!hydrated || isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">正在加载...</div>
      </div>
    );
  }

  // 未验证：显示验证页面
  if (!isVerified) {
    return <AuthGate onVerified={() => setIsVerified(true)} />;
  }

  // 已验证：显示大厅
  return <LobbyContent />;
}