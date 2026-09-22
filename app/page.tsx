import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  FlaskConical,
  Github,
  MessageCircle,
  Play,
  Swords,
  Vote,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Avalon — LLM agents playing Avalon',
  description:
    'Play The Resistance: Avalon with LLM agents and explore results from 140 AI-only games.',
};

const resultUrl = 'https://github.com/Felix471/avalon-ai#result';
const repositoryUrl = 'https://github.com/Felix471/avalon-ai';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900/60 px-4 py-10 text-slate-200 backdrop-blur-sm sm:py-14">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-5">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.jpg"
              alt="AI 阿瓦隆"
              width={56}
              height={56}
              className="size-14 rounded-xl object-cover"
              priority
            />
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-amber-400">
                AI 阿瓦隆
              </h1>
              <p className="mt-1 text-slate-400">Avalon with LLM agents</p>
            </div>
          </div>
          <p className="leading-7 text-slate-300">
            A playable version of The Resistance: Avalon where you take one seat and models from
            Anthropic, OpenAI, Google, DeepSeek and xAI take the others. They discuss, propose teams,
            vote, run quests and hunt for Merlin. The game interface is in Chinese.
            <br />
            <span className="text-slate-400">
              你坐一个位置，其余座位由 Claude、GPT、Gemini、DeepSeek、Grok
              担任：讨论、组队、投票、执行任务、刺杀梅林。
            </span>
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Play and experiment">
          <article className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <Play className="mb-4 size-6 text-amber-400" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-white">Play / 开始游戏</h2>
            <p className="mt-3 flex-1 leading-6 text-slate-400">
              Five seats by default: you plus four models. A game takes about 15–25 minutes.
            </p>
            <Link
              href="/play"
              data-testid="landing-play"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <Play className="size-4" aria-hidden="true" />
              开始游戏 · Play
            </Link>
          </article>

          <article className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <FlaskConical className="mb-4 size-6 text-amber-400" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-white">The experiment / 实验</h2>
            <p className="mt-3 flex-1 leading-6 text-slate-400">
              140 five-player AI-only games across 9 configurations, reproducing Lan et al. (EMNLP
              2024) with April-2026 models.
            </p>
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 font-medium text-amber-400 hover:text-amber-300"
            >
              Read the result
            </a>
          </article>
        </section>

        <section className="space-y-5" aria-labelledby="experiment-heading">
          <div className="flex items-center gap-3">
            <FlaskConical className="size-5 text-amber-400" aria-hidden="true" />
            <h2 id="experiment-heading" className="text-2xl font-bold text-white">
              The experiment
            </h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-800 text-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Pair (evil win rate)</th>
                  <th scope="col" className="px-4 py-3 font-semibold">full prompt</th>
                  <th scope="col" className="px-4 py-3 font-semibold">naive prompt</th>
                  <th scope="col" className="px-4 py-3 font-semibold">p</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800/40 text-slate-300">
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-white">GPT-5.4 mini ×5</th>
                  <td className="px-4 py-3">46.7% (7/15)</td>
                  <td className="px-4 py-3">93.3% (14/15)</td>
                  <td className="px-4 py-3">0.005</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-white">
                    Claude Sonnet 4.6 ×5
                  </th>
                  <td className="px-4 py-3">73.3% (11/15)</td>
                  <td className="px-4 py-3">73.3% (11/15)</td>
                  <td className="px-4 py-3">1.00</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-white">
                    Heterogeneous (one seat per provider)
                  </th>
                  <td className="px-4 py-3">95.0% (19/20)</td>
                  <td className="px-4 py-3">80.0% (12/15)</td>
                  <td className="px-4 py-3">0.17</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="leading-7 text-slate-300">
            With a single-call prompt per decision, the balance the paper attributes to the agents
            appears only where the prompt asks for it: strategy guidance lowers GPT&apos;s evil win
            rate from 93% to 47%, and does nothing for Claude. Quest-1 sabotage by evil players under
            the full prompt: 0/12 (GPT), 0/10 (Claude), 1/22 (heterogeneous); under the naive prompt:
            10/12, 11/11, 4/7.
          </p>
          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex font-medium text-amber-400 hover:text-amber-300"
          >
            Full result, caveats and data issues in the README
          </a>
        </section>

        <section className="space-y-5" aria-labelledby="round-heading">
          <h2 id="round-heading" className="text-2xl font-bold text-white">How a round works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
              <MessageCircle className="size-5 text-amber-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-white">讨论 / Discuss</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Two rounds of speeches.</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
              <Vote className="size-5 text-amber-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-white">组队与投票 / Propose and vote</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Majority approves; five rejections force the team.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
              <Swords className="size-5 text-amber-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-white">任务 / Quest</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                One fail card sinks it; three successes send the assassin after Merlin.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-700 pt-6 text-sm text-slate-500">
          <span>Ziyi (Felix) Wang</span>
          <span aria-hidden="true">·</span>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-400"
          >
            <Github className="size-4" aria-hidden="true" />
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <span>UI 中文 / English coming</span>
        </footer>
      </div>
    </main>
  );
}
