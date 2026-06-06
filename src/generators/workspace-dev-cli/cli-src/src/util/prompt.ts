/**
 * Interactive prompts — arrow-key selection and validated text input — built on Node's
 * raw-mode stdin and ANSI, so they add no dependencies and bundle to nothing.
 *
 * Every prompt is TTY-gated by `isInteractive()`. Callers must check it first and fall
 * back to a non-interactive path (the agent contract: the CLI never blocks off a TTY).
 */

import * as readline from 'readline';
import { Painter } from '../theme/color';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

interface Key {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
}

/** Arrow-key single-select. Renders to stderr; returns the chosen value. */
export function selectPrompt<T>(
  painter: Painter,
  message: string,
  choices: Array<{ label: string; value: T; hint?: string }>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let index = 0;
    const out = process.stderr;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    out.write('\x1b[?25l'); // hide cursor

    const render = (first: boolean) => {
      if (!first) out.write(`\x1b[${choices.length + 1}A`); // move up to redraw
      out.write(`\x1b[2K  ${painter.bold(message)}\n`);
      choices.forEach((c, i) => {
        const active = i === index;
        const marker = active ? painter.primary('❯') : ' ';
        const label = active ? painter.primary(c.label) : c.label;
        const hint = c.hint ? painter.dim(`  ${c.hint}`) : '';
        out.write(`\x1b[2K  ${marker} ${label}${hint}\n`);
      });
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      out.write('\x1b[?25h'); // restore cursor
    };

    const onKey = (_str: string, key: Key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(130);
      } else if (key.name === 'up' || key.name === 'k') {
        index = (index - 1 + choices.length) % choices.length;
        render(false);
      } else if (key.name === 'down' || key.name === 'j') {
        index = (index + 1) % choices.length;
        render(false);
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(choices[index].value);
      }
    };

    render(true);
    process.stdin.on('keypress', onKey);
    process.stdin.on('error', (e) => {
      cleanup();
      reject(e);
    });
  });
}

/** Validated single-line text input. Re-prompts until `validate` returns null. */
export function textPrompt(
  painter: Painter,
  message: string,
  validate?: (value: string) => string | null,
): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question(`  ${painter.bold(message)} `, (answer) => resolve(answer.trim()));
    });

  return (async () => {
    try {
      for (;;) {
        const value = await ask();
        const err = validate ? validate(value) : null;
        if (!err) {
          rl.close();
          return value;
        }
        process.stderr.write(`  ${painter.paint('error', '✖')} ${err}\n`);
      }
    } catch (e) {
      rl.close();
      throw e;
    }
  })();
}
