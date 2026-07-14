import { arrayMove } from "@dnd-kit/sortable";
import { SECTION_ORDER } from "./cardDefs";
import type { SectionKey } from "./cardDefs";

/*
 * homeCardsReducer.ts — pure drag/drop reducer over the Home card SectionMap
 * (HOME-02). Extracted from the design handoff's `home-cards.js` `findSec`/
 * `onDragOver`/`onDragEnd` bodies (lines 283-308), made pure and independent
 * of dnd-kit's DOM/React wiring so it can be unit-tested directly (mirrors
 * src/shell/railSnap.ts's pure-fn idiom: module-level exports, no React/DOM
 * import, a discriminated/plain-object return, immutable — new SectionMap
 * returned every call, input never mutated).
 */

export type SectionMap = Record<SectionKey, string[]>;

/** findSection — the section key containing `id`, or null if not present in
 *  any section. Mirrors home-cards.js's `findSec`. */
export function findSection(map: SectionMap, id: string): SectionKey | null {
  for (const key of SECTION_ORDER) {
    if ((map[key] || []).includes(id)) return key;
  }
  return null;
}

/** moveBetweenSections — the pure onDragOver logic: removes `activeId` from
 *  its current section and inserts it at `overId`'s index in the destination
 *  section (or the section itself, if `overId` names a section directly).
 *  No-op (returns the same-shaped but new object) when the active id isn't
 *  found, the over target can't be resolved to a section, or `from === to`
 *  (dnd-kit's own onDragOver already handles within-section hover reordering
 *  via reorderWithinSection at drop time). Always returns a NEW SectionMap;
 *  never mutates `map`. */
export function moveBetweenSections(map: SectionMap, activeId: string, overId: string): SectionMap {
  const from = findSection(map, activeId);
  const to = (SECTION_ORDER as string[]).includes(overId) ? (overId as SectionKey) : findSection(map, overId);
  if (!from || !to || from === to) {
    // Still return a fresh object per the immutability contract, but with
    // unchanged section arrays (no mutation of the input's nested arrays).
    return { ...map };
  }
  const src = map[from].filter((x) => x !== activeId);
  const dst = [...map[to]];
  const overIdx = dst.indexOf(overId);
  dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, activeId);
  return { ...map, [from]: src, [to]: dst };
}

/** reorderWithinSection — the pure onDragEnd logic: arrayMoves `activeId` to
 *  `overId`'s index within whichever single section currently contains
 *  `activeId`. No-op (returns a fresh but unchanged-content SectionMap) when
 *  `activeId` isn't found, `overId` isn't found in the same section, or the
 *  computed indices are equal. Always returns a NEW SectionMap; never
 *  mutates `map`. */
export function reorderWithinSection(map: SectionMap, activeId: string, overId: string): SectionMap {
  const sec = findSection(map, activeId);
  if (!sec) return { ...map };
  const items = map[sec];
  const oldIdx = items.indexOf(activeId);
  const newIdx = items.indexOf(overId);
  if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) {
    return { ...map };
  }
  return { ...map, [sec]: arrayMove(items, oldIdx, newIdx) };
}
