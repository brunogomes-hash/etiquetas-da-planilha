import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import JsBarcode from "jsbarcode";
import { Barcode, RotateCw, Zap, Printer, CheckCheck, Search, Loader2 } from "lucide-react";
import { obterDados, dispararPython, marcarComoImpressas, type Etiqueta } from "@/lib/sheets.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Etiquetas WMS" },
      { name: "description", content: "Impressão de etiquetas de ondas de separação a partir da planilha." },
      { property: "og:title", content: "Gerador de Etiquetas WMS" },
      { property: "og:description", content: "Impressão de etiquetas de ondas de separação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const FILTROS = ["TODOS", "B2B", "COLMEIA", "CHECKOUT"] as const;

function badge(tipo: string) {
  const t = tipo.toUpperCase();
  if (t.includes("B2B")) return "badge-b2b";
  if (t.includes("CHECKOUT")) return "badge-checkout";
  return "badge-colmeia";
}

function Label({ e }: { e: Etiqueta }) {
  const a = useRef<SVGSVGElement>(null), b = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const o = { format: "CODE128", displayValue: false, height: 140, width: 3.5, margin: 0 };
    if (a.current && e.onda) JsBarcode(a.current, e.onda, o);
    if (b.current && e.barra) JsBarcode(b.current, e.barra, o);
  }, [e]);
  const t = e.tipo.toUpperCase();
  const lbl = t.includes("B2B") || t.includes("PREFEITURA") ? "PACK" : "CAIXA";
  return (
    <div className="etiqueta-card">
      <div className="etiqueta-header">
        <h1>{e.tipo}</h1>
        <h2>{e.identificador}</h2>
        {e.pecas && <div className="qtd-pecas">(Qtd Peças: {e.pecas})</div>}
      </div>
      <hr className="linha-preta" />
      <div className="etiqueta-body">
        <div className="secao-barra"><div className="titulo-barra">ONDA: {e.onda}</div><svg ref={a} className="barcode-svg" /></div>
        <hr className="linha-preta" />
        <div className="secao-barra"><div className="titulo-barra">{lbl}: {e.barra}</div><svg ref={b} className="barcode-svg" /></div>
      </div>
    </div>
  );
}

function Index() {
  const fetchDados = useServerFn(obterDados), fPy = useServerFn(dispararPython), fBaixa = useServerFn(marcarComoImpressas);
  const [dados, setDados] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<string>("TODOS");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [imprimir, setImprimir] = useState<Etiqueta[]>([]);
  const [aviso, setAviso] = useState<{ t: string; m: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    setLoading(true); setErro("");
    try { setDados(await fetchDados()); setSel(new Set()); } catch (e: any) { setErro(e.message); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const contar = (f: string) => f === "TODOS" ? dados.length : dados.filter((d) => d.tipo.toUpperCase().includes(f)).length;
  const visiveis = useMemo(() => dados.filter((d) =>
    (filtro === "TODOS" || d.tipo.toUpperCase().includes(filtro)) &&
    `${d.tipo} ${d.identificador} ${d.onda} ${d.barra}`.toLowerCase().includes(busca.toLowerCase())), [dados, filtro, busca]);
  const todosMarcados = visiveis.length > 0 && visiveis.every((v) => sel.has(v.onda));

  const toggle = (o: string) => setSel((s) => { const n = new Set(s); n.has(o) ? n.delete(o) : n.add(o); return n; });
  const toggleTodos = () => setSel((s) => { const n = new Set(s); visiveis.forEach((v) => todosMarcados ? n.delete(v.onda) : n.add(v.onda)); return n; });

  const doImprimir = () => {
    if (!sel.size) return setAviso({ t: "Atenção", m: "Selecione ao menos uma onda para imprimir." });
    setImprimir(dados.filter((d) => sel.has(d.onda)));
    setTimeout(() => { window.print(); }, 300);
  };
  const doPython = async () => {
    setOcupado(true);
    try {
      const r = await fPy();
      setAviso(r === "EM_ANDAMENTO" ? { t: "Aguarde", m: "Já existe uma consulta ao WMS em andamento." } : { t: "Enviado", m: "Consulta ao WMS solicitada. Atualize em alguns instantes." });
    } catch (e: any) { setAviso({ t: "Erro", m: e.message }); }
    setOcupado(false);
  };
  const doBaixa = async () => {
    setConfirmar(false); setOcupado(true);
    try { const r = await fBaixa({ data: { ondas: [...sel] } }); setAviso({ t: "Sucesso", m: `${r.movidas} linha(s) movida(s) para 'Impressas'.` }); await carregar(); }
    catch (e: any) { setAviso({ t: "Erro", m: e.message }); }
    setOcupado(false);
  };

  return (
    <>
      <div className="app-screen">
        <div className="mx-auto max-w-[1300px] space-y-5">
          <header className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold"><Barcode className="text-primary" /> Gerador de Etiquetas WMS</h1>
              <p className="text-sm text-muted-foreground">Impressão de ondas de separação</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" onClick={carregar}><RotateCw size={16} /> Atualizar</button>
              <button className="btn btn-primary" onClick={doPython} disabled={ocupado}><Zap size={16} /> Consultar WMS</button>
              <button className="btn btn-warning" onClick={doImprimir}><Printer size={16} /> Imprimir Etiquetas</button>
              <button className="btn btn-success" disabled={ocupado} onClick={() => sel.size ? setConfirmar(true) : setAviso({ t: "Atenção", m: "Selecione ao menos uma onda para dar baixa." })}><CheckCheck size={16} /> Dar Baixa</button>
            </div>
          </header>

          <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <button key={f} className={`pill ${filtro === f ? "pill-active" : ""}`} onClick={() => setFiltro(f)}>
                  {f === "TODOS" ? "Todos" : f === "B2B" ? "B2B" : f[0] + f.slice(1).toLowerCase()} <span className="pill-count">{contar(f)}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-[260px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="field w-full pl-9" placeholder="Buscar Onda, Pack ou Tipo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="data-table">
                <thead><tr>
                  <th className="w-12 text-center"><input type="checkbox" className="chk" checked={todosMarcados} onChange={toggleTodos} /></th>
                  <th>Tipo</th><th>Identificador / Pack</th><th>Onda</th><th>Caixa / Pack</th><th>Peças</th>
                </tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="state"><Loader2 className="mx-auto mb-3 animate-spin text-primary" />Carregando dados da planilha...</td></tr>
                  : erro ? <tr><td colSpan={6} className="state text-destructive">{erro}</td></tr>
                  : !visiveis.length ? <tr><td colSpan={6} className="state">Nenhuma onda encontrada.</td></tr>
                  : visiveis.map((d, i) => (
                    <tr key={d.onda + i} onClick={() => toggle(d.onda)} className="cursor-pointer">
                      <td className="text-center"><input type="checkbox" className="chk" checked={sel.has(d.onda)} onChange={() => toggle(d.onda)} onClick={(e) => e.stopPropagation()} /></td>
                      <td><span className={`badge-tipo ${badge(d.tipo)}`}>{d.tipo}</span></td>
                      <td>{d.identificador}</td><td className="font-mono font-semibold">{d.onda}</td>
                      <td className="font-mono">{d.barra}</td><td>{d.pecas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div id="areaImpressao">{imprimir.map((e, i) => <Label key={i} e={e} />)}</div>

      {(aviso || confirmar) && (
        <div className="modal-bg" onClick={() => { setAviso(null); setConfirmar(false); }}>
          <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {confirmar ? <>
              <h3 className="mb-2 text-lg font-bold">Confirmar Baixa</h3>
              <p className="mb-5 text-muted-foreground">Deseja dar baixa e mover as {sel.size} onda(s) selecionada(s) para a aba <strong className="text-foreground">'Impressas'</strong>?</p>
              <div className="flex justify-end gap-2"><button className="btn btn-outline" onClick={() => setConfirmar(false)}>Cancelar</button><button className="btn btn-success" onClick={doBaixa}>Confirmar e Mover</button></div>
            </> : <>
              <h3 className="mb-2 text-lg font-bold">{aviso!.t}</h3>
              <p className="mb-5 text-muted-foreground">{aviso!.m}</p>
              <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setAviso(null)}>Entendido</button></div>
            </>}
          </div>
        </div>
      )}
    </>
  );
}
