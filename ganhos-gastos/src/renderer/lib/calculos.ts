/**
 * ============================================================================
 *  CÁLCULOS — Hora Extra · Férias · Manutenção
 * ============================================================================
 *  Reproduz as fórmulas da planilha "Ganhos & Gastos":
 *
 *  HORA EXTRA (aba "Hora Extra"):
 *     HORA 100% = (SAÍDA − ENTRADA) − (ALMOÇO FIM − ALMOÇO INÍCIO)
 *     HORA 50%  = FIM PLANTÃO − SAÍDA            (máx. 0)
 *     valorHora = salárioBruto / 220             (220 h/mês = 44 h/sem CLT)
 *     R$ 100%   = HORA 100% × valorHora × 2      (adicional de 100%)
 *     R$ 50%    = HORA 50%  × valorHora × 1,5    (adicional de 50%)
 *     (confere com a planilha: bruto ≈ 2830 → 25,73 e 19,30)
 *
 *  FÉRIAS (aba "Férias"):
 *     período aquisitivo fixo Abril/AAAA − Abril/AAAA+1
 *     dias = fim − início ; saldo = 30 − Σ dias do período
 *     Valor (cálculo do app, cálculo trabalhista aproximado):
 *       férias gozadas = dias × (bruto/30) × 4/3   (+ 1/3 constitucional)
 *       abono (venda)  = dias vendidos × (bruto/30) × 4/3 (+ 1/3 constitucional)
 *     Assim, vender 10 dias mantém o total: 20 dias gozados + 10 vendidos
 *     = 30 diárias, ambos com o 1/3. Ex.: bruto 2.829,94 →
 *     30 dias = 3.773,25 ; 20 gozados + 10 vendidos = 3.773,26 (1 centavo
 *     de diferença só por arredondamento de cada rubrica).
 *
 *  MANUTENÇÃO (aba "Manutenção C4"):
 *     próxima data = data + intervalo (meses)
 *     próxima KM   = km + intervalo (km)
 *     status = URGENTE se (próx.data ≤ hoje ou próx.KM ≤ KM atual)
 *              PRÓXIMO se (próx.data ≤ hoje+30 ou próx.KM ≤ KM atual+1000)
 *              OK      caso contrário
 */

/** Horas padrão mensais para converter salário bruto em valor de hora (CLT 44h/sem). */
export const HORAS_MES = 220;
/** Dias de férias por período aquisitivo. */
export const DIAS_FERIAS_PERIODO = 30;
/** Máximo de dias vendidos (abono pecuniário) — 1/3 de 30 dias. */
export const MAX_DIAS_VENDIDOS = 10;

// ---------------------------------------------------------------------------
//  HORAS / TEMPO
// ---------------------------------------------------------------------------

/** "07:30" → 7.5 (decimais). Aceita "HH:MM". Retorna 0 se inválido. */
export function horasDeHHMM(texto: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((texto ?? '').trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0;
  return h + min / 60;
}

/**
 * Duração em horas entre dois horários, considerando virada de dia
 * (se o fim for menor que o início, soma 24h).
 */
export function horasEntre(inicio: string, fim: string): number {
  const a = horasDeHHMM(inicio);
  const b = horasDeHHMM(fim);
  const dif = b - a;
  return dif >= 0 ? dif : dif + 24;
}

export interface CalculoHoraExtra {
  valorHora: number;
  horas100: number;
  horas50: number;
  valor100: number;
  valor50: number;
  total: number;
  /** true se algum horário obrigatório está faltando/inválido. */
  incompleto: boolean;
}

export function calcularHoraExtra(
  r: {
    chegada: string;
    almocoInicio: string;
    almocoFim: string;
    saidaEmpresa: string;
    fimPlantao: string;
  },
  salarioBruto: number,
): CalculoHoraExtra {
  const valorHora = (Number(salarioBruto) || 0) / HORAS_MES;

  const temAlmoco = !!r.almocoInicio && !!r.almocoFim;
  const bruto100 = horasEntre(r.chegada, r.saidaEmpresa) - (temAlmoco ? horasEntre(r.almocoInicio, r.almocoFim) : 0);
  const horas100 = Math.max(0, bruto100);
  const horas50 = r.fimPlantao ? Math.max(0, horasEntre(r.saidaEmpresa, r.fimPlantao)) : 0;

  const valor100 = horas100 * valorHora * 2; // adicional 100%
  const valor50 = horas50 * valorHora * 1.5; // adicional 50%

  const incompleto = !r.chegada || !r.saidaEmpresa;

  return {
    valorHora,
    horas100,
    horas50,
    valor100,
    valor50,
    total: valor100 + valor50,
    incompleto,
  };
}

// ---------------------------------------------------------------------------
//  FÉRIAS
// ---------------------------------------------------------------------------

export interface CalculoFerias {
  diaria: number;
  /** Base das férias gozadas (dias × diária), sem o 1/3. */
  baseFerias: number;
  /** 1/3 constitucional sobre as férias gozadas. */
  tercoFerias: number;
  /** Férias gozadas + 1/3 constitucional. */
  valorFerias: number;
  /** Base do abono pecuniário (dias vendidos × diária), sem o 1/3. */
  baseAbono: number;
  /** 1/3 constitucional sobre o abono. */
  tercoAbono: number;
  /** Abono pecuniário + 1/3 constitucional. */
  valorAbono: number;
  total: number;
}

export function calcularFerias(
  diasRetirados: number,
  diasVendidos: number,
  salarioBruto: number,
): CalculoFerias {
  const bruto = Number(salarioBruto) || 0;
  const diaria = bruto / DIAS_FERIAS_PERIODO;
  const retirados = Math.max(0, Number(diasRetirados) || 0);
  const vendidos = Math.min(MAX_DIAS_VENDIDOS, Math.max(0, Number(diasVendidos) || 0));

  // O 1/3 constitucional incide tanto nos dias gozados quanto no abono
  // pecuniário (dias vendidos). Sem isso, vender 10 dias reduziria o total.
  // Arredondamos cada componente em centavos antes de somar, para que os
  // valores exibidos na tela "fechem" com o total (padrão de folha de pgto.).
  const baseFerias = arred(retirados * diaria);
  const tercoFerias = arred(baseFerias / 3);
  const valorFerias = arred(baseFerias + tercoFerias);

  const baseAbono = arred(vendidos * diaria);
  const tercoAbono = arred(baseAbono / 3);
  const valorAbono = arred(baseAbono + tercoAbono);

  return {
    diaria,
    baseFerias,
    tercoFerias,
    valorFerias,
    baseAbono,
    tercoAbono,
    valorAbono,
    total: arred(valorFerias + valorAbono),
  };
}

const MESES_EXTENSO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Período aquisitivo fixo Abril/AAAA − Abril/AAAA+1.
 * Início em >= Abril pertence ao período do próprio ano; antes de Abril, ao anterior.
 * Ex.: 2026-08-03 → "Abril/2026 - Abril/2027".
 */
export function periodoAquisitivoDe(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const ano = d.getFullYear();
  const mes = d.getMonth() + 1; // 1..12
  const inicio = mes >= 4 ? ano : ano - 1;
  return `Abril/${inicio} - Abril/${inicio + 1}`;
}

/** Saldo de dias restantes de um período (30 − Σ dias gozados − Σ dias vendidos). */
export function saldoPeriodo(
  registros: { periodo: string; diasRetirados: number; diasVendidos?: number }[],
  periodo: string,
): number {
  const usados = registros
    .filter((r) => r.periodo === periodo)
    .reduce(
      (soma, r) =>
        soma + (Number(r.diasRetirados) || 0) + (Number(r.diasVendidos) || 0),
      0,
    );
  return DIAS_FERIAS_PERIODO - usados;
}

// ---------------------------------------------------------------------------
//  MANUTENÇÃO
// ---------------------------------------------------------------------------

/** Data ISO + N meses (ajusta o dia para o fim do mês se necessário). */
export function addMeses(dataISO: string, meses: number): string {
  const d = new Date(`${dataISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.round(meses));
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return paraISO(d);
}

/** Data ISO + N dias. */
export function addDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

export function paraISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hojeISO(): string {
  return paraISO(new Date());
}

export type StatusManutencao = 'URGENTE' | 'PROXIMO' | 'OK';

export interface ItemManutencao {
  data: string;
  km?: number;
  intervaloDataMeses: number;
  intervaloKm?: number;
}

export interface AvaliacaoManutencao {
  proximaData: string | null;
  proximoKm: number | null;
  status: StatusManutencao;
}

/**
 * Avalia um item de manutenção contra o KM atual e a data de hoje,
 * usando exatamente os limiares da planilha.
 */
export function avaliarManutencao(
  item: ItemManutencao,
  kmAtual: number,
  hoje = hojeISO(),
): AvaliacaoManutencao {
  const proximaData = item.data ? addMeses(item.data, item.intervaloDataMeses || 0) : null;
  const proximoKm =
    item.km != null && item.intervaloKm ? item.km + item.intervaloKm : null;

  const km = Number(kmAtual) || 0;
  const dataVencida = !!proximaData && proximaData <= hoje;
  const kmVencido = proximoKm != null && proximoKm <= km;
  const dataProxima = !!proximaData && proximaData <= addMeses(hoje, 1) && proximaData > hoje
    ? proximaData <= addDias(hoje, 30)
    : false;
  const kmProximo = proximoKm != null && proximoKm <= km + 1000 && proximoKm > km;

  let status: StatusManutencao = 'OK';
  if (dataVencida || kmVencido) status = 'URGENTE';
  else if (dataProxima || kmProximo) status = 'PROXIMO';

  return { proximaData, proximoKm, status };
}

/** Presets comuns de intervalo (melhoria sobre a planilha, que usa valores fixos por linha). */
export interface PresetRevisao {
  rotulo: string;
  meses: number;
  km?: number;
}

export const PRESETS_REVISAO: PresetRevisao[] = [
  { rotulo: 'Óleo + filtros', meses: 6, km: 5000 },
  { rotulo: 'Alinhamento / balanceamento', meses: 6, km: 10000 },
  { rotulo: 'Freios (pastilhas/discos)', meses: 12, km: 10000 },
  { rotulo: 'Correia dentada', meses: 60, km: 60000 },
  { rotulo: 'Fluido do radiador', meses: 24, km: 40000 },
  { rotulo: 'Ar-condicionado', meses: 12, km: 10000 },
  { rotulo: 'Pneus', meses: 60, km: 40000 },
  { rotulo: 'Personalizado', meses: 0, km: undefined },
];

// ---------------------------------------------------------------------------
//  AGRUPAMENTO POR MÊS (dashboard de hora extra)
// ---------------------------------------------------------------------------
export interface TotalMes {
  /** "YYYY-MM" */
  chave: string;
  rotulo: string;
  total: number;
  valor100: number;
  valor50: number;
  horas100: number;
  horas50: number;
  quantidade: number;
}

/** Agrupa registros (com cálculo aplicado) por mês, ordenado cronologicamente. */
export function agruparPorMes<T>(
  registros: T[],
  obterData: (r: T) => string,
  calcular: (r: T) => { valor100: number; valor50: number; horas100: number; horas50: number },
): TotalMes[] {
  const mapa = new Map<string, TotalMes>();
  for (const r of registros) {
    const iso = obterData(r);
    if (!iso || iso.length < 7) continue;
    const chave = iso.slice(0, 7);
    let item = mapa.get(chave);
    if (!item) {
      const [ano, mes] = chave.split('-');
      item = {
        chave,
        rotulo: `${MESES_EXTENSO[Number(mes) - 1]?.slice(0, 3) ?? mes}/${ano}`,
        total: 0,
        valor100: 0,
        valor50: 0,
        horas100: 0,
        horas50: 0,
        quantidade: 0,
      };
      mapa.set(chave, item);
    }
    const c = calcular(r);
    item.total += c.valor100 + c.valor50;
    item.valor100 += c.valor100;
    item.valor50 += c.valor50;
    item.horas100 += c.horas100;
    item.horas50 += c.horas50;
    item.quantidade += 1;
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

/** Arredonda para 2 casas (dinheiro). */
export function arred(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}
