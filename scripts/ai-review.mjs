#!/usr/bin/env node
/**
 * The AI reviewer behind `.github/workflows/ai-review.yml`.
 *
 * It reads the pull request's diff, asks Claude to review it against the
 * defect catalogue in `.github/ai-review/prompt.md`, posts the findings as
 * inline review comments, and exits non-zero if any finding is `critical`.
 * The exit status is the gate: make this job a required status check and a
 * critical finding blocks the merge.
 *
 * Two rules govern this file, because it is itself a verification instrument
 * and the catalogue it enforces is full of instruments that lied:
 *
 *  1. It never reports success for work it did not do. If the diff is empty
 *     while the workflow counted changed files, if the model returns nothing
 *     parseable, or if the API call fails, the job fails loudly. "No findings"
 *     is only ever printed after a review that actually ran.
 *  2. Its exit status is its own. Nothing here is piped; the caller runs
 *     `node scripts/ai-review.mjs` directly.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

/** Above this, the diff is trimmed — and the trim is always announced. */
const MAX_DIFF_BYTES = 350_000;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; the reviewer cannot run.`);
  return value;
}

/**
 * The lines an inline comment may be attached to: every line present on the
 * right-hand side of a hunk, added or context. GitHub rejects a comment on a
 * line outside the diff with a 422, which would lose the whole review, so
 * anything that does not land here is folded into the review body instead.
 */
export function commentableLines(diff) {
  const byFile = new Map();
  let file = null;
  let newLine = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (file && !byFile.has(file)) byFile.set(file, new Set());
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      newLine = m ? Number(m[1]) : 0;
      continue;
    }
    if (!file || newLine === 0) continue;
    if (raw.startsWith('+') || raw.startsWith(' ')) {
      byFile.get(file).add(newLine);
      newLine += 1;
    }
    // A '-' line consumes no right-hand line number; '\' (no newline at end
    // of file) consumes nothing either.
  }
  return byFile;
}

const FINDINGS_TOOL = {
  name: 'report_findings',
  description: 'Report the review findings for this pull request.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Two or three sentences: what the diff does and what was checked.',
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: {
              type: 'integer',
              description: 'Line number in the new file, or 0 for the change as a whole.',
            },
            severity: { type: 'string', enum: ['critical', 'warning'] },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['file', 'line', 'severity', 'title', 'body'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'findings'],
    additionalProperties: false,
  },
};

async function gh(method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      authorization: `Bearer ${required('GITHUB_TOKEN')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${endpoint} -> ${res.status}: ${text.slice(0, 800)}`);
  }
  return text ? JSON.parse(text) : null;
}

function summaryLine(text) {
  process.stdout.write(`${text}\n`);
  const file = process.env['GITHUB_STEP_SUMMARY'];
  if (file) appendFileSync(file, `${text}\n`);
}

async function main() {
  const apiKey = required('ANTHROPIC_API_KEY');
  const model = process.env['ANTHROPIC_MODEL'] || 'claude-opus-5';
  const repo = required('GITHUB_REPOSITORY');
  const prNumber = required('PR_NUMBER');
  const headSha = required('HEAD_SHA');
  const diffFile = required('DIFF_FILE');
  const changedFiles = Number(required('CHANGED_FILES'));

  let diff = readFileSync(diffFile, 'utf8');

  // The instrument checks itself before it reports. A diff of zero bytes
  // against a non-zero file count means the diff step produced nothing usable,
  // and a clean review of nothing is exactly the false green this pipeline
  // exists to catch.
  if (changedFiles > 0 && diff.trim().length === 0) {
    throw new Error(
      `The workflow counted ${changedFiles} changed file(s) but the diff is empty. ` +
        'Refusing to report a clean review of a diff that was never read.'
    );
  }
  if (changedFiles === 0) {
    summaryLine('## AI Review\n\nNo files changed. Nothing to review.');
    return 0;
  }

  let truncated = false;
  if (Buffer.byteLength(diff, 'utf8') > MAX_DIFF_BYTES) {
    truncated = true;
    diff = Buffer.from(diff, 'utf8').subarray(0, MAX_DIFF_BYTES).toString('utf8');
  }

  const instructions = readFileSync(path.join(repoRoot, '.github/ai-review/prompt.md'), 'utf8');

  const userContent = [
    truncated
      ? `NOTE: this diff is larger than ${MAX_DIFF_BYTES} bytes and has been cut off. ` +
        'Review what you can see and say in your summary that the tail was not reviewed.'
      : null,
    `The pull request touches ${changedFiles} file(s). The unified diff follows.`,
    '',
    '<diff>',
    diff,
    '</diff>',
  ]
    .filter(Boolean)
    .join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: instructions,
    messages: [{ role: 'user', content: userContent }],
    tools: [FINDINGS_TOOL],
    tool_choice: { type: 'tool', name: 'report_findings' },
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error('The model hit max_tokens before reporting; the review is incomplete.');
  }
  if (response.stop_reason === 'refusal') {
    throw new Error(
      `The model declined to review this diff (${response.stop_details?.category ?? 'no category'}).`
    );
  }

  const call = response.content.find(
    (b) => b.type === 'tool_use' && b.name === 'report_findings'
  );
  if (!call) {
    throw new Error(
      `The model returned no report_findings call (stop_reason: ${response.stop_reason}). ` +
        'Treating this as a failed review rather than a clean one.'
    );
  }

  const { summary, findings } = call.input;
  const commentable = commentableLines(diff);

  const inline = [];
  const orphans = [];
  for (const f of findings) {
    const label = f.severity === 'critical' ? 'CRITICAL' : 'Warning';
    const text = `**${label} — ${f.title}**\n\n${f.body}`;
    const lines = commentable.get(f.file);
    if (f.line > 0 && lines?.has(f.line)) {
      inline.push({ path: f.file, line: f.line, side: 'RIGHT', body: text });
    } else {
      orphans.push(`- \`${f.file}${f.line > 0 ? `:${f.line}` : ''}\` — ${text}`);
    }
  }

  const criticals = findings.filter((f) => f.severity === 'critical');
  const warnings = findings.filter((f) => f.severity === 'warning');

  const header = [
    '## AI Review',
    '',
    summary,
    '',
    `**${criticals.length} critical**, ${warnings.length} warning(s). ` +
      'Critical findings block the merge; warnings are informational.',
    truncated
      ? `\n> The diff exceeded ${MAX_DIFF_BYTES} bytes and was cut off. The tail was **not** reviewed.`
      : '',
    orphans.length ? `\n### Findings not attached to a diff line\n\n${orphans.join('\n\n')}` : '',
  ].join('\n');

  // If posting the review fails, the findings are still printed and the job
  // still fails on a critical — a lost comment must not become a silent pass.
  try {
    await gh('POST', `/repos/${repo}/pulls/${prNumber}/reviews`, {
      commit_id: headSha,
      event: 'COMMENT',
      body: header,
      comments: inline,
    });
  } catch (err) {
    process.stderr.write(`::warning::Could not post the review: ${err.message}\n`);
    await gh('POST', `/repos/${repo}/issues/${prNumber}/comments`, {
      body: `${header}\n\n### Findings\n\n${inline
        .map((c) => `- \`${c.path}:${c.line}\` — ${c.body}`)
        .join('\n\n')}`,
    });
  }

  summaryLine(header);
  for (const f of criticals) {
    process.stdout.write(
      `::error file=${f.file}${f.line > 0 ? `,line=${f.line}` : ''}::${f.title}\n`
    );
  }
  for (const f of warnings) {
    process.stdout.write(
      `::warning file=${f.file}${f.line > 0 ? `,line=${f.line}` : ''}::${f.title}\n`
    );
  }

  if (criticals.length > 0) {
    summaryLine(`\n**Blocked:** ${criticals.length} critical finding(s) must be resolved.`);
    return 1;
  }
  return 0;
}

// Only run when invoked directly, so the diff parser above can be exercised
// from a harness without firing a review.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`::error::AI review failed: ${err.message}\n`);
      process.exitCode = 1;
    }
  );
}
