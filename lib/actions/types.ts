export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};
