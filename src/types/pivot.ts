export interface PivotTableData {
  columns: string[];
  rows: string[][];
  totalRow?: string[];
}

export interface ChartConfigData {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut';
  chartTitle: string;
  labels: string[];
  datasetLabel: string;
  dataValues: number[];
}

export interface AIPivotResult {
  queryTitle: string;
  explanation: string;
  pivotTable: PivotTableData;
  chartConfig: ChartConfigData;
  keyFindings: string[];
  decisionRecommendations: string[];
}
