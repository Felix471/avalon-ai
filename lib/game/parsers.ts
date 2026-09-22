/**
 * Lenient parsers for model answers that should be a list of player ids
 * (team building) or a single player id (assassination).
 *
 * Models often follow the answer with an explanation that mentions other
 * players ("2号一直沉默…"). Reading every digit in the text then breaks the
 * answer, so these parsers look for the first run of separated numbers that
 * forms a valid answer and ignore everything after it.
 */

/** Strip label words and markdown so "玩家1,玩家4" / "- **1、4**" become "1,4" / "1、4". */
function normalize(text: string): string {
  return text
    .replace(/玩家|player|号|\bP(?=\d)/gi, '')
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-•·]\s*/gm, '');
}

/** Runs of numbers separated by commas, 、, spaces, slashes or 和/and. */
const NUMBER_RUN = /\d+(?:\s*(?:[,，、/]|和|and|\s)\s*\d+)*/gi;

function uniqueValid(run: string, validIds: Set<number>): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const raw of run.match(/\d+/g) ?? []) {
    const id = parseInt(raw, 10);
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Returns the first run of `requiredSize` distinct valid ids, scanning lines
 * top to bottom and runs left to right, or null if no such run exists.
 */
export function parseTeamSelection(
  text: string,
  validIds: Iterable<number>,
  requiredSize: number,
): number[] | null {
  const valid = new Set(validIds);
  for (const line of normalize(text).split(/\r?\n/)) {
    for (const run of line.match(NUMBER_RUN) ?? []) {
      const ids = uniqueValid(run, valid);
      if (ids.length === requiredSize) return ids;
    }
  }
  return null;
}

/**
 * Returns the first valid target id on the first non-empty line, falling back
 * to the first valid id anywhere in the text, or null.
 */
export function parseTargetSelection(text: string, validIds: Iterable<number>): number | null {
  const valid = new Set(validIds);
  const lines = normalize(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const candidates = [lines[0] ?? '', lines.join('\n')];
  for (const candidate of candidates) {
    for (const raw of candidate.match(/\d+/g) ?? []) {
      const id = parseInt(raw, 10);
      if (valid.has(id)) return id;
    }
  }
  return null;
}
