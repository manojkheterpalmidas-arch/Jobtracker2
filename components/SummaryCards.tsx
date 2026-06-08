import { BarChart3, Database, Gauge, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { movementDirectionLabels, type SearchSummary } from "@/lib/types";

type SummaryCardsProps = {
  summary?: SearchSummary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  const championMode = typeof summary?.knownMidasAccounts === "number";
  const items = championMode
    ? [
        ["Total job changes found", summary?.jobChangesFound ?? 0],
        ["Known MIDAS accounts", summary?.knownMidasAccounts ?? 0],
        ["High-potential champions", summary?.highPotentialChampions ?? 0],
        ["Medium-potential champions", summary?.mediumPotentialChampions ?? 0],
        ["Unknown previous companies", summary?.unknownPreviousCompanies ?? 0],
        ["MIDAS DB companies", summary?.midasDatabaseCompaniesCount ?? 0],
        ["Credits/API calls", `${summary?.creditsUsed ?? 0} / ${summary?.apiCallsUsed ?? 0}`]
      ]
    : [
        ["Total contacts found", summary?.totalContactsFound ?? 0],
        ["Job changes found", summary?.jobChangesFound ?? 0],
        ["High-priority contacts", summary?.highPriorityContacts ?? 0],
        ["Credits/API calls", `${summary?.creditsUsed ?? 0} / ${summary?.apiCallsUsed ?? 0}`]
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map(([label, value], index) => {
        const labelText = String(label);
        const Icon = index === 0 ? BarChart3 : labelText.includes("MIDAS") ? Database : labelText.includes("High") ? Star : labelText.includes("Credits") ? Gauge : Users;

        return (
        <Card key={label} className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <span className="rounded-lg bg-slate-100 p-1.5 text-slate-500">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
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
        );
      })}
    </div>
  );
}
