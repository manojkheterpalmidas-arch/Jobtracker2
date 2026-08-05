import type { ContactJobChange } from "@/lib/types";

function firstName(fullName: string) {
  return fullName.split(" ").filter(Boolean)[0] ?? fullName;
}

export function generateSuggestedMessage(record: Pick<ContactJobChange, "personName" | "newCompany" | "newTitle">) {
  const name = firstName(record.personName);
  const focus =
    /bridge/i.test(record.newTitle)
      ? "bridge analysis, structural assessment, or FEM workflows"
      : /geotechnical|ground|tunnel/i.test(record.newTitle)
        ? "ground engineering, soil structure interaction, or analysis workflows"
        : "bridge analysis, structural assessment, or civil structures workflows";

  return `Hi ${name}, congratulations on your new role at ${record.newCompany}. Hope the move has gone well. It would be great to reconnect once you are settled, especially if ${focus} come up in your new team.`;
}
