/** An id as a URL segment: `flow:cancel` becomes `flow-cancel`. */
export const keyOf = (id: string): string => id.replaceAll(/[^\w.-]/g, '-');
