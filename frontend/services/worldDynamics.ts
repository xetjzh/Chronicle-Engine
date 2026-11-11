import type { Character, LocationNode } from '../types';
export function relationshipState(character: Character, otherId: string) {
  const saved = character.relationshipScores?.[otherId]; if (saved) return { affection: saved.affection, trust: saved.trust };
  const tag = character.relationships[otherId];
  return tag === '照顾' ? { affection: 40, trust: 75 } : tag === '旧识' ? { affection: 25, trust: 70 }
    : ['怀疑', '戒备'].includes(tag) ? { affection: -20, trust: 25 } : { affection: 0, trust: 50 };
}
export function relationshipLabel(value: { affection: number; trust: number }) {
  return value.trust <= 25 || value.affection <= -40 ? '怀疑' : value.trust >= 65 && value.affection >= 35 ? '照顾' : value.trust >= 65 && value.affection >= 20 ? '旧识' : '漠然';
}
export function changeRelationship(character: Character, otherId: string, affection: number, trust: number) {
  const old = relationshipState(character, otherId);
  const value = { affection: Math.min(100, Math.max(-100, old.affection + affection)), trust: Math.min(100, Math.max(0, old.trust + trust)) };
  character.relationshipScores = { ...character.relationshipScores, [otherId]: value };
  character.relationships[otherId] = relationshipLabel(value);
  return { characterId: character.id, field: `relationshipScores.${otherId}`, oldValue: old, newValue: value };
}
export function shortestPath(locations: LocationNode[], from: string, to: string): string[] {
  const nodes = new Map(locations.map(l => [l.id, l])); if (!nodes.has(from) || !nodes.has(to) || from === to) return [];
  const parent = new Map<string, string>([[from, '']]), queue = [from];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of nodes.get(queue[cursor])!.connectedLocationIds) {
      if (!nodes.has(next) || parent.has(next)) continue; parent.set(next, queue[cursor]);
      if (next === to) { const path = [to]; while (parent.get(path[0]) !== from) path.unshift(parent.get(path[0])!); return path; }
      queue.push(next);
    }
  }
  return [];
}
