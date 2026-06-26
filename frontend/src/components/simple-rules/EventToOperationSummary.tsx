export function EventToOperationSummary({ eventName, operationName }: { eventName: string; operationName: string }) {
  return <span>{eventName} -&gt; {operationName}</span>;
}
