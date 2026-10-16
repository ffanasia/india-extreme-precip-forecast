export async function getJson<T>(url: string, tries = 4, timeoutMs = 60_000): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Varsha/0.1 (mainland India extreme precipitation research desk)",
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`${response.status} ${text.slice(0, 280)}`)
      }
      return (await response.json()) as T
    } catch (error) {
      last = error
      if (attempt < tries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt))
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}
