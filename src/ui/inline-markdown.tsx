/** Renders the two inline marks plans use: `code` and **bold**. Everything else stays plain text. */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.length > 1 && part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.length > 3 && part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    return part
  })}</>
}

/** Paragraphs split on blank lines and "- Label:" fact lines, each with inline marks. */
export function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n+|\s+(?=- [A-Z][\w -]+:)/).filter(Boolean)
  return <>{paragraphs.map((paragraph, i) => <p key={i}><InlineMarkdown text={paragraph.replace(/^- /, '')} /></p>)}</>
}
