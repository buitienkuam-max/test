export type DiceResult = [number, number, number];

export enum Outcome {
  TAI = "TAI", // Big (11-17)
  XIU = "XIU", // Small (4-10)
}

export interface Session {
  id: string;
  dice: DiceResult;
  total: number;
  outcome: Outcome;
  timestamp: number;
}

export interface AnalysisResult {
  pattern: string;
  prediction: Outcome | null;
  confidence: number; // 0 to 1
  reasoning: string;
  aiInsights?: string;
  diceFrequency?: Record<number, number>;
}

export interface AiAnalysis {
  prediction: "TAI" | "XIU" | "SKIP";
  summary: string;
  patterns: {
    type: string;
    status: string;
    details: string;
  };
  frequency: {
    hotspots: string;
    repeated: string;
  };
  trends: {
    direction: string;
    amplitude: string;
  };
  strategy: {
    confidence: number;
    action: string;
    risk: string;
  };
  rationale: string;
}

export enum StrategyType {
  MARTINGALE = "Martingale",
  FLAT = "Flat Betting",
  FIBONACCI = "Fibonacci",
  PAROLI = "Paroli",
  DALEMBERT = "D'Alembert",
  DA_CHIEU = "Đa Chiều (AI)",
}

export interface BacktestConfig {
  initialBalance: number;
  baseBet: number;
  strategy: StrategyType;
  stopLoss: number;
  takeProfit: number;
  betMultiplier: number;
}

export interface BacktestStep {
  sessionId: string;
  prediction: Outcome | null;
  actual: Outcome;
  betAmount: number;
  win: boolean;
  balance: number;
  timestamp: number;
}

export interface BacktestResult {
  steps: BacktestStep[];
  totalProfit: number;
  winRate: number;
  maxDrawdown: number;
  finalBalance: number;
  totalBets: number;
  wins: number;
  losses: number;
  sharpeRatio: number;
  sortinoRatio: number;
}
