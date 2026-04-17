const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  info(message: string): void {
    // Keep production logs minimal; info is primarily for development diagnostics.
    if (!isProduction) {
      console.info(message);
    }
  },

  warn(message: string): void {
    console.warn(message);
  },

  error(message: string): void {
    console.error(message);
  },
};
