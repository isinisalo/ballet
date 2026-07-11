const semverPattern = /(?:^|[^0-9])(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?/;

export const parseSemanticVersion = (value: string): [number, number, number] | undefined => {
  const match = semverPattern.exec(value);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const compareSemanticVersions = (left: string, right: string): number => {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  if (!a || !b) throw new Error(`Cannot compare invalid semantic versions: ${left} and ${right}`);
  for (let index = 0; index < 3; index += 1) {
    const difference = a[index]! - b[index]!;
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

export const isVersionAtLeast = (actual: string, minimum: string): boolean =>
  compareSemanticVersions(actual, minimum) >= 0;
