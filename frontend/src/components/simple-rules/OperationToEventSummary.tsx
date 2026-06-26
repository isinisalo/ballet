export function OperationToEventSummary({ operationName, eventName }: { operationName: string; eventName: string }) {
  return <span>{operationName} -&gt; {eventName}</span>;
}
