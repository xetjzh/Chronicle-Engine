export function filterDocumentChapters<T extends { title: string; content: string }>(chapters: T[], query: string) {
  const search = query.trim();
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => !search || chapter.title.includes(search) || chapter.content.includes(search));
}
