export function* deepParse(object: Record<string, any>) {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== "object" || !Array.isArray(value)) {
      if (!isNaN(Number(value))) {
        yield [key, value];
      }

      try {
        yield [key, JSON.parse(value)];
      }
      catch {
        yield [key, value]
      }
    }
    else {
      yield [key, value]
    }
  }
}
