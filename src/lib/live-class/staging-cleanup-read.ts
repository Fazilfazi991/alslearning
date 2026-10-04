type QueryError = { code?: string; message?: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };
type RetryEvent = { query: string; attempt: number; outcome: "retrying" | "recovered" | "exhausted" };

const delays = [500, 1_500];

// Rebuild only cleanup SELECTs. Mutations and provider calls must not be
// replayed merely because a temporary gateway credential was rejected.
export async function readStagingCleanup<T>(
  query: string,
  read: () => PromiseLike<QueryResult<T>>,
  options: {
    wait?: (milliseconds: number) => Promise<void>;
    report?: (event: RetryEvent) => void;
  } = {},
): Promise<QueryResult<T>> {
  const wait = options.wait || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const report = options.report || (event => console.warn("Staging cleanup authentication", {
    ...event, observedAt: new Date().toISOString(), code: "PGRST303", message: "JWT issued at future",
  }));
  for (let attempt = 1; ; attempt++) {
    const result = await read();
    if (result.error?.code !== "PGRST303" || result.error.message !== "JWT issued at future") {
      if (!result.error && attempt > 1) report({ query, attempt, outcome: "recovered" });
      return result;
    }
    const delay = delays[attempt - 1];
    if (delay === undefined) {
      report({ query, attempt, outcome: "exhausted" });
      return result;
    }
    report({ query, attempt, outcome: "retrying" });
    await wait(delay);
  }
}
