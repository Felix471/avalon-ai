# Avalon AI Batch Results Summary
Generated: 2026-09-22T05:33:30.672Z
Total games: 140

## heterogeneous-full (n=20)

### Win Rates
- Good wins: 1/20 (5.0%)
- Evil wins: 19/20 (95.0%)

### Win Reasons
- Three quests succeeded: 1
- Three quests failed: 18
- Merlin assassinated: 1
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 2
- Successful (killed Merlin): 1 (50.0%)

### Game Metrics
- Avg duration: 722.1s
- Avg LLM calls: 208.4
- Avg quests completed: 4.5
- Leader approval rate: 27.4%
- Evil sabotage rate: 66.7%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## homogeneous-gpt4o (n=15)

### Win Rates
- Good wins: 8/15 (53.3%)
- Evil wins: 7/15 (46.7%)

### Win Reasons
- Three quests succeeded: 8
- Three quests failed: 3
- Merlin assassinated: 4
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 12
- Successful (killed Merlin): 4 (33.3%)

### Game Metrics
- Avg duration: 220.4s
- Avg LLM calls: 223.9
- Avg quests completed: 4.5
- Leader approval rate: 33.2%
- Evil sabotage rate: 52.2%

### Data Quality
- Total fallbacks: 5
- Games with >5 fallbacks: 0

## homogeneous-claude (n=15)

### Win Rates
- Good wins: 4/15 (26.7%)
- Evil wins: 11/15 (73.3%)

### Win Reasons
- Three quests succeeded: 4
- Three quests failed: 11
- Merlin assassinated: 0
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 4
- Successful (killed Merlin): 0 (0.0%)

### Game Metrics
- Avg duration: 543.4s
- Avg LLM calls: 139.3
- Avg quests completed: 4.7
- Leader approval rate: 56.3%
- Evil sabotage rate: 65.7%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## heterogeneous-naive (n=15)

### Win Rates
- Good wins: 3/15 (20.0%)
- Evil wins: 12/15 (80.0%)

### Win Reasons
- Three quests succeeded: 3
- Three quests failed: 10
- Merlin assassinated: 2
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 5
- Successful (killed Merlin): 2 (40.0%)

### Game Metrics
- Avg duration: 690.8s
- Avg LLM calls: 202.1
- Avg quests completed: 3.8
- Leader approval rate: 10.3%
- Evil sabotage rate: 88.6%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## homogeneous-deepseek (n=15)

### Win Rates
- Good wins: 8/15 (53.3%)
- Evil wins: 7/15 (46.7%)

### Win Reasons
- Three quests succeeded: 8
- Three quests failed: 1
- Merlin assassinated: 6
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 14
- Successful (killed Merlin): 6 (42.9%)

### Game Metrics
- Avg duration: 524.6s
- Avg LLM calls: 186.0
- Avg quests completed: 3.2
- Leader approval rate: 4.8%
- Evil sabotage rate: 10.4%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## homogeneous-grok (n=15)

### Win Rates
- Good wins: 2/15 (13.3%)
- Evil wins: 13/15 (86.7%)

### Win Reasons
- Three quests succeeded: 2
- Three quests failed: 13
- Merlin assassinated: 0
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 2
- Successful (killed Merlin): 0 (0.0%)

### Game Metrics
- Avg duration: 206.9s
- Avg LLM calls: 194.9
- Avg quests completed: 3.5
- Leader approval rate: 6.2%
- Evil sabotage rate: 98.0%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## homogeneous-gemini (n=15)

### Win Rates
- Good wins: 2/15 (13.3%)
- Evil wins: 13/15 (86.7%)

### Win Reasons
- Three quests succeeded: 2
- Three quests failed: 12
- Merlin assassinated: 1
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 3
- Successful (killed Merlin): 1 (33.3%)

### Game Metrics
- Avg duration: 1939.0s
- Avg LLM calls: 222.6
- Avg quests completed: 4.6
- Leader approval rate: 32.5%
- Evil sabotage rate: 64.7%

### Data Quality
- Total fallbacks: 26
- Games with >5 fallbacks: 3

## homogeneous-gpt-naive (n=15)

### Win Rates
- Good wins: 1/15 (6.7%)
- Evil wins: 14/15 (93.3%)

### Win Reasons
- Three quests succeeded: 1
- Three quests failed: 13
- Merlin assassinated: 1
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 2
- Successful (killed Merlin): 1 (50.0%)

### Game Metrics
- Avg duration: 211.9s
- Avg LLM calls: 186.3
- Avg quests completed: 3.7
- Leader approval rate: 10.7%
- Evil sabotage rate: 90.4%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## homogeneous-claude-naive (n=15)

### Win Rates
- Good wins: 4/15 (26.7%)
- Evil wins: 11/15 (73.3%)

### Win Reasons
- Three quests succeeded: 4
- Three quests failed: 10
- Merlin assassinated: 1
- Five consecutive rejects: 0

### Assassination
- Assassination attempts: 5
- Successful (killed Merlin): 1 (20.0%)

### Game Metrics
- Avg duration: 680.3s
- Avg LLM calls: 153.0
- Avg quests completed: 3.7
- Leader approval rate: 36.4%
- Evil sabotage rate: 100.0%

### Data Quality
- Total fallbacks: 0
- Games with >5 fallbacks: 0

## Per-Model Performance

| Model | Good Games | Good Win% | Evil Games | Evil Win% |
|-------|-----------|-----------|-----------|-----------|
| claude-sonnet-4-6 | 116 | 24.1% | 69 | 76.8% |
| deepseek-chat | 65 | 36.9% | 45 | 55.6% |
| gemini-2.5-flash | 65 | 15.4% | 45 | 91.1% |
| gpt-5.4-mini | 109 | 26.6% | 76 | 73.7% |
| grok-4-fast-non-reasoning | 65 | 12.3% | 45 | 86.7% |

## Extended Behavioral Metrics

### Discussion Verbosity by Model (Good vs Evil)

| Model | Good Avg Chars | Evil Avg Chars | Ratio (Evil/Good) |
|-------|---------------|---------------|-------------------|
| claude-sonnet-4-6 | 193.1 | 186.3 | 0.96 |
| deepseek-chat | 186.7 | 182.8 | 0.98 |
| gemini-2.5-flash | 171.9 | 179.5 | 1.04 |
| gpt-5.4-mini | 109.0 | 108.0 | 0.99 |
| grok-4-fast-non-reasoning | 247.7 | 234.2 | 0.95 |

### Evil Sabotage Timing by Quest Round

| Quest Round | Evil on Team | Sabotage Count | Sabotage Rate |
|------------|-------------|---------------|--------------|
| 1 | 114 | 39 | 34.2% |
| 2 | 169 | 130 | 76.9% |
| 3 | 117 | 99 | 84.6% |
| 4 | 113 | 84 | 74.3% |
| 5 | 62 | 45 | 72.6% |

### Self-Recommendation Language by Config

| Config | Games | Total Self-Recs | Mean per Game |
|--------|-------|----------------|--------------|
| heterogeneous-full | 20 | 104 | 5.2 |
| homogeneous-gpt4o | 15 | 1 | 0.1 |
| homogeneous-claude | 15 | 108 | 7.2 |
| heterogeneous-naive | 15 | 101 | 6.7 |
| homogeneous-deepseek | 15 | 35 | 2.3 |
| homogeneous-grok | 15 | 86 | 5.7 |
| homogeneous-gemini | 15 | 36 | 2.4 |
| homogeneous-gpt-naive | 15 | 9 | 0.6 |
| homogeneous-claude-naive | 15 | 130 | 8.7 |
