/**
 * Jira liefert Beschreibungen als Atlassian Document Format (ADF) —
 * hier flach zu lesbarem Text gemacht: Textknoten einsammeln,
 * Block-Knoten als Zeilenumbrüche.
 */

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "codeBlock", "blockquote"]);

function collect(node: AdfNode, parts: string[]): void {
  if (typeof node.text === "string") parts.push(node.text);
  for (const child of node.content ?? []) collect(child, parts);
  if (node.type && BLOCK_TYPES.has(node.type)) parts.push("\n");
}

export function adfToText(adf: unknown, maxLength = 600): string {
  if (typeof adf !== "object" || adf === null) return "";
  const parts: string[] = [];
  collect(adf as AdfNode, parts);
  const text = parts.join("").replace(/\n{2,}/g, "\n").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
