// Compiles the question bank + lessons into public/data/*.json for the app.
// Usage: node scripts/build-content.mjs [--strict]
//   --strict  fail if a question is missing from data/verification_report.json or failed verification
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, 'data');
const out = path.join(root, 'public', 'data');
const strict = process.argv.includes('--strict');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
      })
    : [];

const topics = readJson(path.join(data, 'topics.json'));
const files = [path.join(data, 'reference_exam.json'), ...walk(path.join(data, 'questions')).sort()];
let questions = [];
for (const f of files) {
  const raw = readJson(f);
  questions.push(...(Array.isArray(raw) ? raw : raw.questions));
}

const reportPath = path.join(data, 'verification_report.json');
const report = existsSync(reportPath) ? readJson(reportPath).questions : {};
const problems = [];
const seen = new Set();
const bank = [];
for (const q of questions) {
  if (seen.has(q.id)) problems.push(`duplicate id ${q.id}`);
  seen.add(q.id);
  const r = report[q.id];
  if (!r) problems.push(`${q.id} is not in the verification report (run npm run verify)`);
  else if (!r.ok) problems.push(`${q.id} failed verification`);
  bank.push({
    id: q.id,
    chapter: q.chapter,
    topic: q.topic,
    tags: q.tags ?? [],
    type: q.type,
    difficulty: q.difficulty,
    source: q.source,
    stem: q.stem,
    code: q.code ?? null,
    options: q.options.map((o) => ({ id: o.id, text: o.text, ...(o.mono ? { mono: true } : {}) })),
    correct: q.correct,
    explanation: q.explanation,
    notes: q.distractor_notes ?? {},
    slides: q.slides,
    verified: r?.ok ? (String(r.kind).startsWith('exec') ? 'exec' : 'review') : 'no',
    ...(q.quirk ? { quirk: true } : {}),
    ...(q.quirk_note ? { quirkNote: q.quirk_note } : {}),
    ...(q.reconstructed ? { reconstructed: true } : {}),
    ...(q.past_exam ? { pastExam: { page: q.past_exam.page } } : {}),
  });
}

if (problems.length) {
  const msg = `${problems.length} content problem(s):\n  ` + problems.slice(0, 30).join('\n  ');
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn('warning: ' + msg);
}

// ---------------------------------------------------------------- lessons
const lessons = {};
for (const ch of Object.keys(topics.chapters)) {
  const p = path.join(data, 'lessons', `${ch}.md`);
  if (!existsSync(p)) continue;
  const md = readFileSync(p, 'utf8');
  const parts = md.split(/^## /m);
  const intro = parts.shift() ?? '';
  const sections = parts.map((part) => {
    const nl = part.indexOf('\n');
    const head = part.slice(0, nl === -1 ? undefined : nl).trim();
    const body = nl === -1 ? '' : part.slice(nl + 1);
    const m = head.match(/^(.*?)\s*\{#([a-z0-9-]+)\}\s*$/);
    const title = m ? m[1].trim() : head;
    const id = m ? m[2] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { id, title, html: marked.parse(body, { async: false }) };
  });
  lessons[ch] = {
    title: intro.replace(/^#\s*/, '').split('\n')[0].trim(),
    intro: marked.parse(intro.split('\n').slice(1).join('\n'), { async: false }),
    sections,
  };
}

// ---------------------------------------------------------------- chapters/topics meta
const chapters = Object.entries(topics.chapters).map(([id, c]) => ({
  id,
  title: c.title,
  slides: c.slides,
  topics: Object.entries(topics.topics[id] ?? {}).map(([tid, desc]) => ({
    id: tid,
    title: lessons[id]?.sections.find((s) => s.id === tid)?.title ?? tid.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()),
    desc,
  })),
}));

const payload = { chapters, questions: bank };
const version = createHash('sha1').update(JSON.stringify(payload)).update(JSON.stringify(lessons)).digest('hex').slice(0, 10);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'bank.json'), JSON.stringify({ version, generatedAt: new Date().toISOString(), ...payload }));
writeFileSync(path.join(out, 'lessons.json'), JSON.stringify({ version, lessons }));

const byCh = {};
for (const q of bank) byCh[q.chapter] = (byCh[q.chapter] ?? 0) + 1;
console.log(`content ${version}: ${bank.length} questions ${JSON.stringify(byCh)}, lessons for ${Object.keys(lessons).join(' ')}`);
