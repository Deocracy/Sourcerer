/**
 * proposalParse — pure, synchronous parser for the assistant's proposal
 * marker convention (ASST-02, D-02). No new host.ai() event shape: the
 * marker is scanned client-side, once, over the FINAL accumulated
 * assistant message text (on the "done" event), never per streamed delta
 * (bounded cost — T-06-03-02, DoS mitigation). Convention (RESEARCH.md
 * Pattern 3): a line beginning (after optional whitespace) with
 * "Proposal —" / "Proposal:" / "Proposal-" (case-insensitive), optionally
 * carrying a "§ …" target reference in its trailing text, immediately
 * followed (after any blank lines) by one or more Markdown blockquote
 * lines ("> …") whose joined text is the proposal body. Deliberately no
 * general NLP classification — a narrow, linear line-scan only
 * (RESEARCH.md anti-pattern: do not hand-roll a classifier here).
 */

const MARKER_LINE = /^\s*Proposal\s*[—:-]\s*(.*)$/i;
const BLOCKQUOTE_LINE = /^\s*>\s?(.*)$/;
const SECTION_MARK = "§";

export interface Proposal {
  target: string | null;
  body: string;
  raw: string;
}

/**
 * Scans `text` line-by-line for the marker+blockquote pair described
 * above. Returns the first match found, or null when no such pair exists
 * (plain prose, or a marker line with no following blockquote).
 */
export function parseProposal(text: string): Proposal | null {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const markerMatch = MARKER_LINE.exec(lines[i]);
    if (!markerMatch) continue;

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;

    const bodyLines: string[] = [];
    while (j < lines.length) {
      const bqMatch = BLOCKQUOTE_LINE.exec(lines[j]);
      if (!bqMatch) break;
      bodyLines.push(bqMatch[1]);
      j++;
    }
    if (bodyLines.length === 0) continue;

    const trailing = markerMatch[1].trim();
    const sectionIdx = trailing.indexOf(SECTION_MARK);
    const target =
      sectionIdx >= 0
        ? trailing
            .slice(sectionIdx)
            .replace(/:\s*$/, "")
            .trim()
        : null;

    return {
      target,
      body: bodyLines.join("\n"),
      raw: lines.slice(i, j).join("\n"),
    };
  }

  return null;
}
