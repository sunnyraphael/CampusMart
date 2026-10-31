type ReadResult = { error: unknown; status: number }
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Only use for idempotent catalog reads. Never retry an order, payment or other mutation.
export async function retryCatalogRead<T extends ReadResult>(read: () => PromiseLike<T>, wait = pause): Promise<T> {
  const first = await read()
  const transient = first.status === 0 || first.status === 408 || first.status === 429 || first.status >= 500
  if (!first.error || !transient) return first
  await wait(200)
  return await read()
}
