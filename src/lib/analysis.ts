import { Session, Outcome, AnalysisResult } from "../types";

export function analyzeSessions(sessions: Session[]): AnalysisResult {
  if (sessions.length === 0) {
    return {
      pattern: "No Data",
      prediction: null,
      confidence: 0,
      reasoning: "Start by entering session data.",
    };
  }

  // 0. Dice Frequency (Card Counting Concept) - Move up to ensure it's available for all returns
  const diceFrequency: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  sessions.slice(-30).forEach(s => {
    s.dice.forEach(d => {
      diceFrequency[d]++;
    });
  });

  const lastSessions = sessions.slice(-12).reverse(); // Last 12, newest first
  const lastOutcome = lastSessions[0].outcome;
  const lastTotal = lastSessions[0].total;

  // 1. Cầu Bệt (Streak)
  let streakCount = 1;
  for (let i = 1; i < lastSessions.length; i++) {
    if (lastSessions[i].outcome === lastOutcome) {
      streakCount++;
    } else {
      break;
    }
  }

  if (streakCount >= 3) {
    return {
      pattern: `Cầu Bệt (${streakCount})`,
      prediction: lastOutcome,
      confidence: streakCount >= 5 ? 0.9 : 0.7,
      reasoning: `Dấu hiệu bệt ${streakCount} ván liên tiếp. Chiến thuật: Đánh theo bệt cho đến khi gãy.`,
      diceFrequency,
    };
  }

  // 2. Cầu Đảo 1-1 (Alternating)
  let alternatingCount = 1;
  for (let i = 1; i < lastSessions.length; i++) {
    const expected = i % 2 === 0 ? lastOutcome : (lastOutcome === Outcome.TAI ? Outcome.XIU : Outcome.TAI);
    if (lastSessions[i].outcome === expected) {
      alternatingCount++;
    } else {
      break;
    }
  }

  if (alternatingCount >= 4) {
    const nextPrediction = lastOutcome === Outcome.TAI ? Outcome.XIU : Outcome.TAI;
    return {
      pattern: "Cầu Đảo 1-1",
      prediction: nextPrediction,
      confidence: 0.8,
      reasoning: `Dấu hiệu đảo 1-1 liên tiếp ${alternatingCount} ván. Chiến thuật: Đánh đối diện với ván vừa ra.`,
      diceFrequency,
    };
  }

  // 3. Cầu 2-2 (Pairs)
  if (lastSessions.length >= 6) {
    const s = lastSessions;
    const is22 = (s[0].outcome === s[1].outcome) && 
                 (s[2].outcome === s[3].outcome) && 
                 (s[4].outcome === s[5].outcome) &&
                 (s[0].outcome !== s[2].outcome) &&
                 (s[2].outcome === s[4].outcome);
    if (is22) {
      return {
        pattern: "Cầu 2-2 (Cặp)",
        prediction: lastOutcome, // Expecting the second of the pair
        confidence: 0.85,
        reasoning: "Dấu hiệu cầu cặp 2-2 đang chạy. Tiếp tục đánh theo cặp.",
        diceFrequency,
      };
    }
  }

  // 4. Geometric Analysis: Support Point 7
  if (lastTotal === 7) {
    return {
      pattern: "Điểm Neo Đáy (Support)",
      prediction: Outcome.TAI,
      confidence: 0.85,
      reasoning: "Số 7 là điểm xoay cực kỳ nhạy. Xác suất cao sẽ bật ngược (Rebound) lên vùng 11-13.",
      diceFrequency,
    };
  }

  // 4. Geometric Analysis: Failed Peak (13 -> 11)
  if (lastSessions.length >= 2) {
    const prevTotal = lastSessions[1].total;
    if (prevTotal === 13 && lastTotal === 11) {
      return {
        pattern: "Đỉnh Lỗi (Failed Peak)",
        prediction: Outcome.XIU,
        confidence: 0.75,
        reasoning: "Đồ thị tăng lên 13 nhưng sụt xuống 11. Tín hiệu của một đợt rơi sâu sắp tới.",
        diceFrequency,
      };
    }
  }

  // 5. Sideway (11 -> 11)
  if (lastSessions.length >= 2 && lastTotal === lastSessions[1].total) {
    return {
      pattern: "Vùng Đi Ngang (Sideway)",
      prediction: null,
      confidence: 0.5,
      reasoning: "Xuất hiện các con số giống nhau liên tiếp. Đồ thị đang nén, chờ cú bứt phá mạnh.",
      diceFrequency,
    };
  }

  // 6. Volatility Mapping: Dice Specific Rules
  const lastDice = lastSessions[0].dice;
  
  const allSmall = lastDice.every(d => d <= 3);
  if (allSmall) {
    return {
      pattern: "Nguyên lý Nén-Bật (Oversold)",
      prediction: Outcome.TAI,
      confidence: 0.8,
      reasoning: "Cả 3 hạt cùng nằm ở vùng đáy (1, 2, 3). Đây là tín hiệu 'quá bán', một cú bật tăng đồng loạt sắp xảy ra.",
      diceFrequency,
    };
  }

  const hasSix = lastDice.some(d => d === 6);
  if (hasSix) {
    return {
      pattern: "Nguyên lý Bù trừ",
      prediction: Outcome.XIU,
      confidence: 0.65,
      reasoning: "Khi một hạt chạm mức cực đại (6), phiên sau hạt đó thường giảm mạnh. Ưu tiên Xỉu.",
      diceFrequency,
    };
  }

  // Default: Trend Analysis
  const taiCount = lastSessions.filter(s => s.outcome === Outcome.TAI).length;
  const xiuCount = lastSessions.length - taiCount;
  
  if (taiCount > xiuCount) {
    return {
      pattern: "Nhịp Nghiêng (Tài)",
      prediction: Outcome.TAI,
      confidence: 0.6,
      reasoning: `Trong chuỗi gần đây có ${taiCount} Tài / ${xiuCount} Xỉu. Ưu tiên đánh theo cửa nghiêng.`,
      diceFrequency,
    };
  } else if (xiuCount > taiCount) {
    return {
      pattern: "Nhịp Nghiêng (Xỉu)",
      prediction: Outcome.XIU,
      confidence: 0.6,
      reasoning: `Trong chuỗi gần đây có ${xiuCount} Xỉu / ${taiCount} Tài. Ưu tiên đánh theo cửa nghiêng.`,
      diceFrequency,
    };
  }

  return {
    pattern: "Cân Bằng",
    prediction: null,
    confidence: 0.3,
    reasoning: "Tỷ lệ đang ở mức cân bằng 50-50. Chờ nhịp gãy để bắt đầu chu kỳ mới.",
    diceFrequency,
  };
}
