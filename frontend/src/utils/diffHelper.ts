import * as Diff from 'diff';

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  line: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changesCount: number;
  isMultiLine: boolean;
}

/**
 * Computes word-level differences with spaces preserved.
 */
export function getWordDiff(oldText: string = '', newText: string = ''): DiffPart[] {
  if (oldText === newText) {
    return [{ value: newText }];
  }
  return Diff.diffWordsWithSpace(oldText, newText);
}

/**
 * Computes character-level differences for fine-grained edits.
 */
export function getCharDiff(oldText: string = '', newText: string = ''): DiffPart[] {
  if (oldText === newText) {
    return [{ value: newText }];
  }
  return Diff.diffChars(oldText, newText);
}

/**
 * Computes line-by-line differences with old/new line numbers.
 */
export function getLineDiff(oldText: string = '', newText: string = ''): DiffLine[] {
  const parts = Diff.diffLines(oldText, newText);
  const result: DiffLine[] = [];

  let oldNum = 1;
  let newNum = 1;

  for (const part of parts) {
    const rawLines = part.value.split('\n');
    // If ends with newline, last item is empty string from split
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }

    for (const line of rawLines) {
      if (part.added) {
        result.push({
          type: 'added',
          line,
          newLineNumber: newNum++,
        });
      } else if (part.removed) {
        result.push({
          type: 'removed',
          line,
          oldLineNumber: oldNum++,
        });
      } else {
        result.push({
          type: 'unchanged',
          line,
          oldLineNumber: oldNum++,
          newLineNumber: newNum++,
        });
      }
    }
  }

  return result;
}

/**
 * Generates summary statistics for a diff.
 */
export function calculateDiffStats(oldText: string = '', newText: string = ''): DiffStats {
  const isMultiLine = oldText.includes('\n') || newText.includes('\n');
  const wordDiff = Diff.diffWordsWithSpace(oldText, newText);

  let additions = 0;
  let deletions = 0;
  let changesCount = 0;

  for (const part of wordDiff) {
    if (part.added) {
      additions += part.value.trim().length;
      changesCount++;
    } else if (part.removed) {
      deletions += part.value.trim().length;
      changesCount++;
    }
  }

  return {
    additions,
    deletions,
    changesCount,
    isMultiLine,
  };
}
