import { createServerFn } from "@tanstack/react-start";

const ID = "1cwkxPOYWr5aYKeZy53mAcI7qnbn9PcU6BjfnKWasEOQ";
const ABA = "Base";
const GW = "https://connector-gateway.lovable.dev/google_sheets/v4";

export type Etiqueta = { tipo: string; identificador: string; onda: string; barra: string; pecas: string };

async function api(path: string, init?: RequestInit) {
  const l = process.env["LOVABLE_API_KEY"], k = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!l || !k) throw new Error("Credenciais da planilha ausentes");
  const r = await fetch(`${GW}/spreadsheets/${ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${l}`, "X-Connection-Api-Key": k, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Planilha [${r.status}]: ${await r.text()}`);
  return r.json();
}
const s = (v: unknown) => (v == null ? "" : String(v).trim());

export const obterDados = createServerFn({ method: "GET" }).handler(async (): Promise<Etiqueta[]> => {
  const d = await api(`/values/${ABA}!A2:F`);
  return ((d.values ?? []) as unknown[][])
    .map((r) => ({ tipo: s(r[1]), identificador: s(r[2]), onda: s(r[3]), barra: s(r[4]), pecas: s(r[5]) }))
    .filter((e) => e.onda);
});

export const dispararPython = createServerFn({ method: "POST" }).handler(async () => {
  let atual = "";
  try {
    const d = await api(`/values/Atualização!A2`);
    atual = s(d.values?.[0]?.[0]).toUpperCase();
  } catch {
    await api(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Atualização" } } }] }) });
    await api(`/values/Atualização!A1?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [["Status"]] }) });
  }
  if (atual === "PENDENTE" || atual === "EM PROCESSAMENTO") return "EM_ANDAMENTO";
  await api(`/values/Atualização!A2?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [["PENDENTE"]] }) });
  return "ENVIADO";
});

export const marcarComoImpressas = createServerFn({ method: "POST" })
  .inputValidator((d: { ondas: string[] }) => ({ ondas: (d.ondas ?? []).map(String) }))
  .handler(async ({ data }) => {
    const meta = await api(`?fields=sheets.properties.title`);
    const titles: string[] = meta.sheets.map((x: any) => x.properties.title);
    const all = ((await api(`/values/${ABA}!A1:Z`)).values ?? []) as string[][];
    if (all.length <= 1) return { movidas: 0 };
    const [cab, ...rows] = all;
    const mover = rows.filter((r) => data.ondas.includes(s(r[3])));
    const manter = rows.filter((r) => !data.ondas.includes(s(r[3])));
    if (!mover.length) return { movidas: 0 };
    if (!titles.includes("Impressas")) {
      await api(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Impressas" } } }] }) });
      await api(`/values/Impressas!A1?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [cab] }) });
    }
    await api(`/values/Impressas!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: mover }) });
    await api(`/values/${ABA}!A2:Z:clear`, { method: "POST", body: "{}" });
    if (manter.length) await api(`/values/${ABA}!A2?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values: manter }) });
    return { movidas: mover.length };
  });
