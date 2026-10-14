import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

/** Renders teacher / AI study material (Markdown or HTML) safely. */
export default function Markdown({ text, className = "" }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(String(text || ""))), [text]);
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
