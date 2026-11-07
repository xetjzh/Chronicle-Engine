interface ScoredChapter {
  extraction?: { tensionScore?: number };
  tensionScore?: number;
}

export function getNarrativeTension(chapter: ScoredChapter): number | null {
  return chapter.extraction?.tensionScore ?? chapter.tensionScore ?? null;
}
