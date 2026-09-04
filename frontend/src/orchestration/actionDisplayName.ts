export function actionDisplayName(actionName: string, stateName?: string): string {
  if (!stateName) return actionName;
  const prefix = `${stateName} - `;
  return actionName.startsWith(prefix) ? actionName.slice(prefix.length) : actionName;
}
