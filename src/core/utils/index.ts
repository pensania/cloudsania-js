
/**
 * Converts any unknown error into a proper `Error` instance.
 * Useful for catching non-Error throws or raw values.
 * 
 * @param err - The error-like object to convert.
 * @returns A valid `Error` instance.
 */
export const castToError = (err: any): Error => {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err !== null) {
    try {
      return new Error(JSON.stringify(err));
    } catch {}
  }
  return new Error(String(err));
};

