import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { movementDirectionLabels, type SearchSummary } from "@/lib/types";

type SummaryCardsProps = {
  summary?: SearchSummary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  const items = [
    ["Total contacts found", summary?.totalContactsFound ?? 0],
    ["Job changes found", summary?.jobChangesFound ?? 0],
    ["High-priority contacts", summary?.highPriorityContacts ?? 0],
    ["Credits/API calls", `${summary?.creditsUsed ?? 0} / ${summary?.apiCallsUsed ?? 0}`]
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-2xl font-semibold">{value}</p>
              {label === "Total contacts found" && summary ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant={summary.matchType === "domain" ? "success" : summary.matchType === "mock" ? "warning" : "muted"}>
                    {summary.matchType === "domain" ? "Domain matched" : summary.matchType === "mock" ? "Mock data" : "Name matched"}
                  </Badge>
                  <Badge variant="muted">{movementDirectionLabels[summary.movementDirection]}</Badge>
                </div>
              ) : null}
              {label === "Credits/API calls" && summary ? (
                <Badge variant="muted">{summary.signalLookupsRequested} signal checks</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
