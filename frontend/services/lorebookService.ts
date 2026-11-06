import { LorebookEntry } from '../types';

export class LorebookService {
  /**
   * Scans input text (recent events, character goals, user prompt) against Lorebook entries.
   * Mirrors SillyTavern's World Info activation mechanism:
   * 1. Checks constant entries.
   * 2. Scans text for primary key triggers (case-insensitive substring/regex match).
   * 3. Validates secondary keys if defined (AND logic).
   * 4. Sorts activated entries by insertionOrder for pristine prompt hierarchy.
   */
  public static scanAndActivate(
    entries: LorebookEntry[],
    scanContexts: string[]
  ): { activated: LorebookEntry[]; activatedKeys: string[] } {
    const combinedText = scanContexts.join('\n').toLowerCase();
    const activated: LorebookEntry[] = [];
    const activatedKeys: string[] = [];

    const enabledEntries = entries.filter(e => e.enabled);

    for (const entry of enabledEntries) {
      if (entry.isConstant) {
        activated.push(entry);
        activatedKeys.push(`[常驻] ${entry.name}`);
        continue;
      }

      // Check primary keys
      const hitKey = entry.keys.find(k => {
        const trimmed = k.trim().toLowerCase();
        return trimmed.length > 0 && combinedText.includes(trimmed);
      });

      if (hitKey) {
        // If secondary keys exist, at least one secondary key must also be present
        if (entry.secondaryKeys && entry.secondaryKeys.length > 0) {
          const hitSecondary = entry.secondaryKeys.some(sk => {
            const trimmed = sk.trim().toLowerCase();
            return trimmed.length > 0 && combinedText.includes(trimmed);
          });
          if (!hitSecondary) continue;
        }

        activated.push(entry);
        activatedKeys.push(`${entry.name} (命中: "${hitKey}")`);
      }
    }

    // Sort by insertionOrder ascending
    activated.sort((a, b) => a.insertionOrder - b.insertionOrder);

    return { activated, activatedKeys };
  }

  /**
   * Formats activated Lorebook entries into structured context block suitable for AI injection.
   */
  public static formatLorebookPrompt(activatedEntries: LorebookEntry[]): string {
    if (activatedEntries.length === 0) return '';

    const lines = [
      '### 【世界书 / Lorebook 知识库精准动态召回】',
      '（以下背景事实为当前场景因果所涉及的硬性知识，人物对话与描写必须严密恪守，不可冲突）'
    ];

    activatedEntries.forEach((entry, idx) => {
      lines.push(`【条目 #${idx + 1}: ${entry.name}】\n${entry.content}`);
    });

    return lines.join('\n\n');
  }
}
