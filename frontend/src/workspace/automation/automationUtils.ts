const slugValue = (value: string, fallback: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

export const editablePolicyToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "");

export const uniqueAutomationId = (base: string, ids: string[]) => {
  let candidate = slugValue(base, "item");
  let suffix = 2;
  while (ids.includes(candidate)) {
    candidate = `${slugValue(base, "item")}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};
