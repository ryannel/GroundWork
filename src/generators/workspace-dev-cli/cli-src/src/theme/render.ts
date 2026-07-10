/**
 * The render layer — the typographic and structural vocabulary of the CLI.
 *
 * This is the Node port of the bash `_ui.sh` helpers, rebuilt on the brand-token
 * painter so output is themed from the design system rather than hard-coded. It is
 * the shared surface both `./dev` and the `cli-app` starter render through.
 *
 * All human chrome is written to stderr so stdout stays clean for `--json` and pipes.
 */

import { Painter, detectCaps } from './color';
import { BrandTokens, mergeTokens, SymbolName } from './tokens';

const PAD = '  ';

export class Renderer {
  readonly painter: Painter;
  private readonly tokens: BrandTokens;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private spinnerText = '';

  constructor(tokens: BrandTokens, stream: NodeJS.WriteStream = process.stderr) {
    this.tokens = tokens;
    this.out = stream;
    this.painter = new Painter(tokens, detectCaps(stream));
  }

  private out: NodeJS.WriteStream;

  /** A twin renderer bound to a different stream (e.g. stdout for command *results*,
   *  while progress and spinners stay on stderr). */
  asStream(stream: NodeJS.WriteStream): Renderer {
    return new Renderer(this.tokens, stream);
  }

  private sym(name: SymbolName): string {
    const t = this.tokens.terminal?.symbols?.[name];
    if (!t) return '';
    return this.painter.caps.unicode ? t.unicode : t.ascii;
  }

  /** Public access to the themed symbol vocabulary (success/error/warning/...),
   *  for callers that compose their own inline glyphs (e.g. a status/state
   *  column) rather than writing a whole line via success()/warn()/etc. */
  symbol(name: SymbolName): string {
    return this.sym(name);
  }

  private write(line: string): void {
    this.out.write(line + '\n');
  }

  logo(subtitle?: string): void {
    const { wordmark, appName } = this.tokens.identity;
    const mark = this.painter.primary(`${wordmark} ${appName}`.trim());
    this.write('');
    this.write(subtitle ? `${PAD}${this.painter.bold(mark)} ${this.painter.dim('— ' + subtitle)}` : `${PAD}${this.painter.bold(mark)}`);
    this.write('');
  }

  step(text: string): void {
    this.write(`\n${PAD}${this.painter.primary(this.sym('step'))} ${this.painter.bold(text)}`);
  }

  substep(text: string): void {
    this.write(`${PAD}${PAD}${this.painter.dim(`${this.sym('substep')} ${text}`)}`);
  }

  info(text: string): void {
    this.write(`${PAD}${this.painter.dim(this.sym('info'))} ${text}`);
  }

  success(text: string): void {
    this.write(`${PAD}${this.painter.paint('success', this.sym('success'))} ${text}`);
  }

  error(text: string): void {
    this.write(`${PAD}${this.painter.paint('error', this.sym('error'))} ${text}`);
  }

  warn(text: string): void {
    this.write(`${PAD}${this.painter.paint('warning', this.sym('warning'))} ${text}`);
  }

  category(text: string): void {
    this.write(`\n${PAD}${this.painter.dim('■')} ${this.painter.paint('header', text)}`);
  }

  cmd(name: string, desc: string): void {
    this.write(`    ${this.painter.paint('accent', name.padEnd(15))} ${desc}`);
  }

  /** A boxed error card with an optional action line. */
  errorCard(msg: string, action?: string): void {
    const bar = this.painter.paint('error', '│');
    this.write('');
    this.write(`${PAD}${this.painter.paint('error', '╭' + '─'.repeat(58) + '╮')}`);
    this.write(`${PAD}${bar}  ${this.painter.paint('error', this.sym('error'))} ${this.painter.bold('ERROR:')} ${msg}`);
    if (action) {
      this.write(`${PAD}${bar}`);
      this.write(`${PAD}${bar}  ${this.painter.dim('Action required:')}`);
      this.write(`${PAD}${bar}  ${this.painter.paint('accent', this.sym('active'))} ${action}`);
    }
    this.write(`${PAD}${this.painter.paint('error', '╰' + '─'.repeat(58) + '╯')}`);
    this.write('');
  }

  /** A simple three-column table for status output. An optional 4th column
   *  (e.g. a URL, or a pre-styled state glyph) renders unpadded at the row's
   *  tail — callers style it themselves (via `painter`/`symbol()`) since a
   *  fixed pad here would count invisible ANSI codes as width. */
  table(title: string, rows: Array<[string, string, string, string?]>): void {
    this.write(`${PAD}${this.painter.dim('╭─')} ${this.painter.bold(title)}`);
    if (rows.length === 0) {
      this.write(`${PAD}${this.painter.dim('│')}  ${this.painter.dim('(none)')}`);
    }
    for (const [a, b, c, d] of rows) {
      const tail = d ? ` ${d}` : '';
      this.write(`${PAD}${this.painter.dim('│')}  ${a.padEnd(28)} ${b.padEnd(16)} ${this.painter.dim(c)}${tail}`);
    }
    this.write(`${PAD}${this.painter.dim('╰' + '─'.repeat(40))}`);
  }

  // --- Spinner (TTY only; degrades to a static line) -------------------------

  startSpinner(text: string): void {
    this.spinnerText = text;
    if (!this.painter.caps.isTTY) {
      this.write(`${PAD}${this.painter.dim(this.sym('info'))} ${text}...`);
      return;
    }
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const asciiFrames = ['|', '/', '-', '\\'];
    const set = this.painter.caps.unicode ? frames : asciiFrames;
    let i = 0;
    this.out.write('\x1b[?25l'); // hide cursor
    this.spinnerTimer = setInterval(() => {
      const frame = this.painter.primary(set[i % set.length]);
      this.out.write(`\r${PAD}${frame} ${this.spinnerText}`);
      i += 1;
    }, 90);
  }

  stopSpinner(successMsg: string, elapsed?: string): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      this.out.write('\r\x1b[K'); // clear line
      this.out.write('\x1b[?25h'); // restore cursor
    }
    const time = elapsed ? ` ${this.painter.dim(`(${elapsed})`)}` : '';
    this.success(`${successMsg}${time}`);
  }

  failSpinner(failMsg: string): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      this.out.write('\r\x1b[K');
      this.out.write('\x1b[?25h');
    }
    this.error(failMsg);
  }
}

/** Build a renderer from a (possibly partial) tokens object loaded from disk. */
export function makeRenderer(partialTokens: unknown, stream?: NodeJS.WriteStream): Renderer {
  return new Renderer(mergeTokens(partialTokens), stream);
}
