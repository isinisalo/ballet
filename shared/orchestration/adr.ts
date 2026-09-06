/** The repository record is the sole ADR truth; API IDs use lowercase. */
export interface AdrRecord { id: string; title: string; decision: string; scope: string }
export const ADR_ID = /^adr-\d{3,}$/;

export function parseAdr(content: string, expectedId?: string): AdrRecord {
  const match = content.match(/^\[ADR-(\d{3,}): ([^\r\n]+)\]\r?\nDecision: ([^\r\n]+)\r?\nScope: ([^\r\n]+)(?:\r?\n)?$/);
  if (!match) throw new Error("ADR sisältää vain otsikon [ADR-001: Otsikko], Decision: ja Scope: -rivit.");
  const record = { id: `adr-${match[1]}`, title: match[2], decision: match[3], scope: match[4] };
  if (Object.values(record).some((value) => !value.trim() || value !== value.trim()) || record.title.includes("]")) {
    throw new Error("ADR-kentät ovat pakollisia eikä niiden reunoilla saa olla tyhjää tilaa.");
  }
  if (expectedId !== undefined && record.id !== expectedId) throw new Error("ADR-tunniste ei vastaa dokumentin tunnistetta.");
  return record;
}

export function serializeAdr(record: AdrRecord): string {
  if (!ADR_ID.test(record.id)) throw new Error("Tunnisteen muoto on adr-001.");
  const content = `[${record.id.toUpperCase()}: ${record.title}]\nDecision: ${record.decision}\nScope: ${record.scope}\n`;
  parseAdr(content, record.id);
  return content;
}

export function nextAdrId(ids: string[]): string {
  return `adr-${String(Math.max(0, ...ids.filter((id) => ADR_ID.test(id)).map((id) => Number(id.slice(4)))) + 1).padStart(3, "0")}`;
}
