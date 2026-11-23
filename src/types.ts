export type BlockType = 'plasma' | 'fast' | 'cindy' | 'extra' | 'mealprep' | 'call' | 'sleep' | 'other';

/** Egy heti blokk. start: perc a hét hétfő 00:00-tól, dur: perc. */
export interface Block {
  id: string;
  type: BlockType;
  title: string;
  start: number;
  dur: number;
  skipped?: boolean;
  /** cold calling: cél hívásszám */
  target?: number;
}

export interface WeekRec {
  monday: string;
  blocks: Block[];
}

export interface DayRec {
  date: string;
  done: Record<string, boolean>;
  weight?: number;
  steps?: number;
  water?: number;
  cindyRounds?: number;
  calls?: number;
  reached?: number;
  meetings?: number;
}

export interface Measure {
  date: string;
  waist?: number;
  hip?: number;
  thigh?: number;
  chest?: number;
  arm?: number;
  pushups?: number;
  pullups?: number;
}

export interface ReportRec {
  monday: string;
  good: string;
  hard: string;
  focus: string;
}

export interface ExportData {
  app: 'fittapu';
  version: 1;
  exportedAt: string;
  days: DayRec[];
  weeks: WeekRec[];
  measures: Measure[];
  reports: ReportRec[];
  template: Block[];
}
