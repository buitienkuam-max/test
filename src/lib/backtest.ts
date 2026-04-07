import { Session, Outcome, BacktestConfig, BacktestResult, BacktestStep, StrategyType } from "../types";
import { analyzeSessions } from "./analysis";

export function runBacktest(sessions: Session[], config: BacktestConfig): BacktestResult {
  const steps: BacktestStep[] = [];
  let currentBalance = config.initialBalance;
  let currentBet = config.baseBet;
  let wins = 0;
  let losses = 0;
  let maxBalance = config.initialBalance;
  let maxDrawdown = 0;

  // We need at least 5 sessions to start meaningful analysis for AI strategy
  const startIndex = 5;

  // Fibonacci sequence for Fibonacci strategy
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
  let fibIndex = 0;

  // Paroli streak tracking
  let paroliStreak = 0;

  // D'Alembert unit tracking
  let dalembertUnits = 1;

  const returns: number[] = [];

  for (let i = startIndex; i < sessions.length; i++) {
    const historicalSessions = sessions.slice(0, i);
    const currentSession = sessions[i];
    const previousBalance = currentBalance;
    
    // 1. Get Prediction based on strategy
    let prediction: Outcome | null = null;
    let aiConfidence = 0;
    
    if (config.strategy === StrategyType.DA_CHIEU) {
      const analysis = analyzeSessions(historicalSessions);
      prediction = analysis.prediction;
      aiConfidence = analysis.confidence;
    } else {
      // For Martingale, Flat, Fibonacci, Paroli, D'Alembert, we just follow the last outcome (Trend Following)
      prediction = historicalSessions[historicalSessions.length - 1].outcome;
    }

    if (!prediction) continue;

    // 2. Determine Bet Amount
    let betAmount = config.baseBet * (config.betMultiplier || 1);
    if (config.strategy === StrategyType.DA_CHIEU) {
      // AI Strategy: Dynamic bet sizing based on confidence and bankroll percentage
      let bankrollPercent = 0.01; // Low confidence: 1%
      if (aiConfidence >= 0.85) bankrollPercent = 0.05; // High confidence: 5%
      else if (aiConfidence >= 0.75) bankrollPercent = 0.03; // Medium confidence: 3%
      
      betAmount = currentBalance * bankrollPercent * (config.betMultiplier || 1);
      // Ensure it's at least the base bet, but don't exceed current balance
      betAmount = Math.max(betAmount, config.baseBet * (config.betMultiplier || 1));
    } else if (config.strategy === StrategyType.MARTINGALE) {
      betAmount = currentBet * (config.betMultiplier || 1);
    } else if (config.strategy === StrategyType.FIBONACCI) {
      betAmount = config.baseBet * fib[fibIndex] * (config.betMultiplier || 1);
    } else if (config.strategy === StrategyType.PAROLI) {
      betAmount = config.baseBet * Math.pow(2, paroliStreak) * (config.betMultiplier || 1);
    } else if (config.strategy === StrategyType.DALEMBERT) {
      betAmount = config.baseBet * dalembertUnits * (config.betMultiplier || 1);
    }

    const finalBetAmount = Math.min(betAmount, currentBalance);
    if (finalBetAmount <= 0) break;

    const win = prediction === currentSession.outcome;
    
    if (win) {
      currentBalance += finalBetAmount;
      wins++;
      
      // Update strategy state for win
      if (config.strategy === StrategyType.MARTINGALE) {
        currentBet = config.baseBet;
      } else if (config.strategy === StrategyType.FIBONACCI) {
        fibIndex = Math.max(0, fibIndex - 2);
      } else if (config.strategy === StrategyType.PAROLI) {
        paroliStreak++;
        if (paroliStreak >= 3) paroliStreak = 0; // Reset after 3 wins
      } else if (config.strategy === StrategyType.DALEMBERT) {
        dalembertUnits = Math.max(1, dalembertUnits - 1);
      }
    } else {
      currentBalance -= finalBetAmount;
      losses++;
      
      // Update strategy state for loss
      if (config.strategy === StrategyType.MARTINGALE) {
        currentBet *= 2;
      } else if (config.strategy === StrategyType.FIBONACCI) {
        fibIndex = Math.min(fib.length - 1, fibIndex + 1);
      } else if (config.strategy === StrategyType.PAROLI) {
        paroliStreak = 0;
      } else if (config.strategy === StrategyType.DALEMBERT) {
        dalembertUnits++;
      }
    }

    // Track returns for Sharpe/Sortino
    const stepReturn = (currentBalance - previousBalance) / previousBalance;
    returns.push(stepReturn);

    // Track stats
    maxBalance = Math.max(maxBalance, currentBalance);
    const drawdown = maxBalance - currentBalance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    steps.push({
      sessionId: currentSession.id,
      prediction,
      actual: currentSession.outcome,
      betAmount: finalBetAmount,
      win,
      balance: currentBalance,
      timestamp: currentSession.timestamp,
    });

    // Check Stop Loss / Take Profit
    if (currentBalance <= config.stopLoss || currentBalance >= config.takeProfit) {
      break;
    }
  }

  // Calculate Sharpe and Sortino Ratios
  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (returns.length > 0) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Standard Deviation
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;

    // Downside Deviation
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / returns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);
    sortinoRatio = downsideStdDev !== 0 ? avgReturn / downsideStdDev : 0;
  }

  return {
    steps,
    totalProfit: currentBalance - config.initialBalance,
    winRate: steps.length > 0 ? wins / steps.length : 0,
    maxDrawdown,
    finalBalance: currentBalance,
    totalBets: steps.length,
    wins,
    losses,
    sharpeRatio,
    sortinoRatio,
  };
}
