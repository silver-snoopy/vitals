export interface CollectionResult {
  provider: string;
  recordCount: number;
  dateRange: { start: Date; end: Date };
  errors: string[];
}

export interface DataProvider {
  name: string;
  collect(startDate: Date, endDate: Date): Promise<CollectionResult>;
}
