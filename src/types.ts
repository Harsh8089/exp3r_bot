export interface HandlerResponse {
  success: boolean;
  message: string;
  data?: any
}

export type Period = '1d' | '1w' | '1m' | '1yr';

export interface CategorySpend {
  categoryId: number | null;
  _sum: {
    amount: number | null;
  };
  _count: {
    id: number;
  };
}