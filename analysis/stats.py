# In-repo statistics for the Avalon LLM study (port of audit/recompute.py).
#
# Recomputes, per config, from data/games.jsonl:
#   - evil win rate, sabotage rate, leader approval rate (95% Wilson CIs)
#   - self-recommendation regex count per game (legacy keyword rule, for
#     comparison with the LLM-judge re-annotation in analysis/)
#   - assassination accuracy
# and runs two-sided two-proportion z-tests (pooled SE) for the three matched
# full-vs-naive pairs on evil win rate, sabotage rate, and leader approval rate.
#
# Usage: python analysis/stats.py   (from repo root)

import collections
import json
import math
import re

EVIL_ROLES = {'assassin', 'morgana', 'mordred', 'oberon', 'minion'}
# Legacy keyword rule, identical to scripts/metrics.ts:293 (kept for comparison
# only; see analysis/annotate_selfrec.ts for the validated replacement).
SELF_REC_RE = re.compile(r'(带上我|我愿意上|选我|让我上)')

MATCHED_PAIRS = [
    ('homogeneous-gpt4o', 'homogeneous-gpt-naive'),
    ('homogeneous-claude', 'homogeneous-claude-naive'),
    ('heterogeneous-full', 'heterogeneous-naive'),
]


def wilson(k, n, z=1.959964):
    if n == 0:
        return (float('nan'), float('nan'))
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (center - half, center + half)


def fmt_ci(k, n):
    if not n:
        return 'N/A'
    lo, hi = wilson(k, n)
    return f'{100 * k / n:5.1f}% [{100 * lo:.1f}, {100 * hi:.1f}]'


def two_prop_z(k1, n1, k2, n2):
    """Two-sided two-proportion z-test with pooled SE. Returns (z, p)."""
    if n1 == 0 or n2 == 0:
        return (float('nan'), float('nan'))
    p1, p2 = k1 / n1, k2 / n2
    pool = (k1 + k2) / (n1 + n2)
    se = math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return (0.0, 1.0)
    z = (p1 - p2) / se
    p = math.erfc(abs(z) / math.sqrt(2))  # two-sided
    return (z, p)


def main():
    games = [json.loads(l) for l in open('data/games.jsonl', encoding='utf-8')]
    assert len(games) == 140, f'expected 140 games, got {len(games)}'

    byc = collections.OrderedDict()
    for g in games:
        byc.setdefault(g['config'], []).append(g)

    stats = {}
    for cfg, gs in byc.items():
        n = len(gs)
        evil_wins = sum(1 for g in gs if g['winner'] == 'evil')

        evil_actions = fails = 0
        for g in gs:
            evil_ids = {p['id'] for p in g['players'] if p['role'] in EVIL_ROLES}
            for q in g['quests']:
                for pid, action in q['actions'].items():
                    if int(pid) in evil_ids:
                        evil_actions += 1
                        fails += action == 'fail'

        props = [tp for g in gs for tp in g['teamProposals']]
        voted = [tp for tp in props if tp['votes']]
        approved = sum(1 for tp in voted if tp['accepted'])

        recs = sum(
            len(SELF_REC_RE.findall(d['content'])) for g in gs for d in g['discussions']
        )
        attempts = [g for g in gs if g['assassination']]
        correct = sum(1 for g in attempts if g['assassination']['correct'])

        stats[cfg] = {
            'n': n,
            'evil': (evil_wins, n),
            'sab': (fails, evil_actions),
            'appr': (approved, len(voted)),
            'selfrec_pg': recs / n,
            'assn': (correct, len(attempts)),
        }

    print(f'{"config":26} {"n":>3} {"evil win% [95% CI]":>22} {"sabotage% [CI]":>22} '
          f'{"approval% [CI]":>22} {"selfrec/g":>9} {"assassin":>8}')
    for cfg, s in stats.items():
        print(f'{cfg:26} {s["n"]:>3} {fmt_ci(*s["evil"]):>22} {fmt_ci(*s["sab"]):>22} '
              f'{fmt_ci(*s["appr"]):>22} {s["selfrec_pg"]:>9.2f} '
              f'{s["assn"][0]}/{s["assn"][1]:>2}')

    print()
    print('=== Two-proportion z-tests (two-sided, pooled SE): full vs naive matched pairs ===')
    print(f'{"pair":48} {"metric":>10} {"full":>9} {"naive":>9} {"z":>7} {"p":>8}')
    for full_cfg, naive_cfg in MATCHED_PAIRS:
        a, b = stats[full_cfg], stats[naive_cfg]
        for metric, label in [('evil', 'evil win'), ('sab', 'sabotage'), ('appr', 'approval')]:
            k1, n1 = a[metric]
            k2, n2 = b[metric]
            z, p = two_prop_z(k1, n1, k2, n2)
            print(f'{full_cfg + " vs " + naive_cfg:48} {label:>10} '
                  f'{k1}/{n1:>4} {k2}/{n2:>4} {z:>7.2f} {p:>8.4f}')

    print()
    print('Note: z-tests treat individual quest actions / proposals as independent,')
    print('which ignores within-game clustering; evil-win tests (unit = game) are clean.')
    print('Self-rec is a per-game count, not a proportion — no z-test; see the')
    print('LLM-judge re-annotation (analysis/annotate_selfrec.ts) for its validated version.')


if __name__ == '__main__':
    main()
