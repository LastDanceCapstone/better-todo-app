const shouldLog = __DEV__;

export const logger = {
  info(message: string): void {
    if (shouldLog) {
      console.info(message);
    }
  },

  warn(message: string): void {
    if (shouldLog) {
      console.warn(message);
    }
  },

  error(message: string): void {
    if (shouldLog) {
      console.error(message);
    }
  },
};
