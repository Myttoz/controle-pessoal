/**
 * Fila SEQUENCIAL de escritas.
 *
 * A planilha usa lock: duas escritas simultâneas podem falhar com codigo "LOCK".
 * Toda escrita passa por aqui e roda uma de cada vez. Leituras (GET) ficam
 * fora da fila e podem correr em paralelo.
 */
let ultima: Promise<unknown> = Promise.resolve();

export function agendarEscrita<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = ultima.then(
    () => fn(),
    () => fn(),
  );
  // mantém a cadeia viva mesmo quando uma escrita falha
  ultima = resultado.then(
    () => undefined,
    () => undefined,
  );
  return resultado;
}
