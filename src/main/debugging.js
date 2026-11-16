import chalk from 'chalk';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_URL = pathToFileURL(SRC_DIR).href;

const MAX_FRAMES = 6;
const MAX_CAUSE_DEPTH = 3;
const NOISE = /node:|node_modules|\(<anonymous>\)|\(index \d+\)/;

const shortenFrame = (line) =>
  line
    .trim()
    .replaceAll(`${SRC_URL}/`, './')
    .replaceAll(`${SRC_DIR}${path.sep}`, './');

export function formatError(err, depth = 0) {
  if (!(err instanceof Error)) {
    return typeof err === 'string' ? err : inspect(err, { depth: 3, breakLength: Infinity });
  }

  const code = err.code && !String(err.message).includes(err.code) ? ` [${err.code}]` : '';
  const lines = [`${err.name}: ${err.message}${code}`];

  const allFrames = (err.stack ?? '').split('\n').filter((l) => /^\s+at /.test(l));
  const ownFrames = allFrames.filter((l) => !NOISE.test(l));
  const frames = (ownFrames.length ? ownFrames : allFrames).slice(0, MAX_FRAMES);
  for (const frame of frames) lines.push(chalk.gray(`    ${shortenFrame(frame)}`));

  if (depth < MAX_CAUSE_DEPTH) {
    if (err.cause !== undefined) lines.push(`Caused by: ${formatError(err.cause, depth + 1)}`);
    if (Array.isArray(err.errors)) {
      err.errors.forEach((e, i) => lines.push(`  [${i + 1}/${err.errors.length}] ${formatError(e, depth + 1)}`));
    }
  }
  return lines.join('\n');
}

const format = (args) =>
  args
    .map((a) =>
      a instanceof Error ? `\n${formatError(a)}`
      : typeof a === 'string' ? a
      : inspect(a, { depth: 3, breakLength: Infinity })
    )
    .join(' ')
    .replace(/ \n/g, '\n')
    .replace(/^\n/, '');

const errorTag = chalk.redBright.bold('[ERROR]');

function formattedError(context, err) {
  if (err === undefined && typeof context !== 'string') {
    err = context;
    context = null;
  }
  const body = formatError(err);
  console.log(`${errorTag}${context ? chalk.red(` ${context}`) : ''}${context ? '\n' : ' '}${chalk.red(body)}`);
}

export const log = {
  info: (...msg) => console.log(chalk.cyan.bold('[INFO]') + chalk.white(` ${format(msg)}`)),
  warn: (...msg) => console.log(chalk.yellow.bold('[WARN]') + chalk.yellowBright(` ${format(msg)}`)),
  formattedError,
  error: (...msg) => console.log(chalk.redBright.bold('[ERROR]') + chalk.red(` ${format(msg)}`)),
  success: (...msg) => console.log(chalk.greenBright.bold('[SUCCESS]') + chalk.green(` ${format(msg)}`)),
  debug: (...msg) => console.log(chalk.magenta.bold('[DEBUG]') + chalk.gray(` ${format(msg)}`)),
};
