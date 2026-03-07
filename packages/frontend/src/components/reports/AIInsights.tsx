export function AIInsights({ insights }: { insights: string }) {
  return (
    <div className="whitespace-pre-wrap rounded-md bg-muted px-4 py-3 text-sm leading-relaxed">
      {insights}
    </div>
  );
}
