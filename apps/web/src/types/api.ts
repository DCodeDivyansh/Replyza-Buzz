export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
  errors?: ApiErrorDetail[] | Record<string, string[]>;
}
