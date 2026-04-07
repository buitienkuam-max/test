import React, { useState, useMemo, useEffect } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceLine, AreaChart, Area, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, History, Plus, AlertCircle, 
  ChevronRight, Activity, BarChart3, Info, Trash2, Settings2, Upload, X,
  ChevronDown, BookOpen, Target, Zap
} from "lucide-react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Session, Outcome, DiceResult, AnalysisResult, StrategyType, BacktestConfig, BacktestResult, AiAnalysis } from "./types";
import { analyzeSessions } from "./lib/analysis";
import { runBacktest } from "./lib/backtest";
import { getDeepLearningAnalysis } from "./services/geminiService";

const PATTERN_GUIDE = [
  {
    id: "bet",
    title: "Cầu Bệt (Long Streak)",
    icon: <TrendingUp className="w-4 h-4 text-red-500" />,
    characteristics: "Một kết quả (Tài hoặc Xỉu) xuất hiện liên tiếp trong nhiều ván (thường từ 4 ván trở lên).",
    identification: "Nhìn vào bảng lịch sử thấy một cột dọc dài cùng màu. Đây là loại cầu phổ biến và dễ kiếm lợi nhuận nhất.",
    strategy: "Chiến thuật 'Đu bệt': Tiếp tục đặt cược theo kết quả đó cho đến khi cầu gãy. Tuyệt đối không bẻ cầu sớm vì bệt có thể kéo dài tới 10-15 ván."
  },
  {
    id: "1-1",
    title: "Cầu 1-1 (Alternating)",
    icon: <Activity className="w-4 h-4 text-emerald-500" />,
    characteristics: "Kết quả luân phiên thay đổi giữa Tài và Xỉu sau mỗi ván (T-X-T-X).",
    identification: "Biểu đồ lịch sử đi theo hình răng cưa đều đặn. Thường xuất hiện sau một chuỗi bệt dài.",
    strategy: "Đánh nghịch đảo: Ván trước ra Tài thì ván sau đánh Xỉu và ngược lại. Cần quan sát kỹ nhịp cầu (thường kéo dài 4-6 ván)."
  },
  {
    id: "2-2",
    title: "Cầu 2-2 (Double Alternating)",
    icon: <Zap className="w-4 h-4 text-blue-500" />,
    characteristics: "Hai ván Tài tiếp nối bởi hai ván Xỉu (T-T-X-X).",
    identification: "Các cặp kết quả lặp lại đều đặn. Đây là biến thể của cầu 1-1 nhưng nhịp chậm hơn.",
    strategy: "Đánh theo cặp: Nếu thấy đã ra 2 Tài, ván tiếp theo hãy bắt đầu đánh Xỉu và giữ Xỉu cho ván kế tiếp."
  },
  {
    id: "3-1",
    title: "Cầu 3-1 (Triple-Single)",
    icon: <Target className="w-4 h-4 text-amber-500" />,
    characteristics: "Ba ván cùng một kết quả, sau đó là một ván kết quả ngược lại (T-T-T-X hoặc X-X-X-T).",
    identification: "Thường xuất hiện khi thị trường đang có xu hướng chuyển giao từ bệt sang cầu ngắn.",
    strategy: "Đánh chặn: Sau khi kết thúc chuỗi 3 ván giống nhau, ván thứ 4 đánh mạnh vào kết quả ngược lại."
  },
  {
    id: "neo-7",
    title: "Điểm Neo 7 (Anchor Point 7)",
    icon: <AlertCircle className="w-4 h-4 text-purple-500" />,
    characteristics: "Tổng điểm xúc xắc bằng đúng 7.",
    identification: "Đây là điểm số 'nhạy cảm' trong toán học xác suất Tài Xỉu, thường báo hiệu sự thay đổi xu hướng.",
    strategy: "Quan sát điểm rơi: Nếu điểm 7 xuất hiện sau một chuỗi Tài, thường là dấu hiệu Xỉu sẽ còn kéo dài. Nếu xuất hiện đơn lẻ, thường là điểm 'hồi' để quay lại Tài."
  }
];

const PatternAccordion = ({ pattern }: { pattern: typeof PATTERN_GUIDE[0] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30 mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            {pattern.icon}
          </div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{pattern.title}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-4 pt-0 space-y-3 border-t border-slate-800/50 bg-slate-950/20">
              <div>
                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Đặc điểm</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{pattern.characteristics}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Cách nhận biết</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{pattern.identification}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Chiến thuật</h4>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed italic">"{pattern.strategy}"</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CollapsibleSection = ({ title, icon, children, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-slate-600 transition-transform", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 border-t border-slate-800/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AiAnalysisDashboard = ({ analysis }: { analysis: AiAnalysis }) => {
  const isTai = analysis.prediction === "TAI";
  const isXiu = analysis.prediction === "XIU";
  const isSkip = analysis.prediction === "SKIP";

  return (
    <div className="space-y-3">
      {/* Prediction Header */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 shadow-2xl relative overflow-hidden",
          isTai ? "bg-red-500/10 border-red-500/40 shadow-red-500/20" :
          isXiu ? "bg-blue-500/10 border-blue-500/40 shadow-blue-500/20" :
          "bg-slate-500/10 border-slate-500/40 shadow-slate-500/20"
        )}
      >
        <div className={cn(
          "absolute top-0 left-0 w-full h-1 animate-pulse",
          isTai ? "bg-red-500" : isXiu ? "bg-blue-500" : "bg-slate-500"
        )} />
        <span className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-400">AI PROJECTION</span>
        <div className="flex items-center gap-6">
          <span className={cn(
            "text-5xl font-black tracking-tighter drop-shadow-sm",
            isTai ? "text-red-500" :
            isXiu ? "text-blue-500" :
            "text-slate-400"
          )}>
            {analysis.prediction}
          </span>
          <div className="h-10 w-[1px] bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
            <span className={cn(
              "text-xl font-black font-mono",
              analysis.strategy.confidence > 70 ? "text-emerald-500" : "text-amber-500"
            )}>
              {analysis.strategy.confidence}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 italic text-slate-400 text-[11px] leading-relaxed flex gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p>"{analysis.summary}"</p>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-2">
        <CollapsibleSection 
          title="Phân Tích Cầu (Pattern)" 
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold text-slate-500">Loại cầu</span>
              <span className="text-[11px] font-bold text-white">{analysis.patterns.type}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold text-slate-500">Trạng thái</span>
              <span className="text-[11px] font-bold text-emerald-500">{analysis.patterns.status}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
              {analysis.patterns.details}
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Tần Suất & Số Lặp" 
          icon={<Activity className="w-4 h-4 text-blue-500" />}
        >
          <div className="space-y-2">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Điểm nóng</span>
              <p className="text-[11px] text-slate-300">{analysis.frequency.hotspots}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Lặp lại</span>
              <p className="text-[11px] text-slate-300">{analysis.frequency.repeated}</p>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Biểu Đồ Xu Hướng" 
          icon={<TrendingDown className="w-4 h-4 text-amber-500" />}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold text-slate-500">Hướng di chuyển</span>
              <span className="text-[11px] font-bold text-white">{analysis.trends.direction}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold text-slate-500">Biên độ</span>
              <span className="text-[11px] font-bold text-white">{analysis.trends.amplitude}</span>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Chiến Thuật Gợi Ý" 
          icon={<Zap className="w-4 h-4 text-purple-500" />}
          defaultOpen={true}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Rủi ro</span>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  analysis.strategy.risk === "Thấp" ? "text-emerald-500" : 
                  analysis.strategy.risk === "Trung Bình" ? "text-amber-500" : "text-red-500"
                )}>
                  {analysis.strategy.risk}
                </span>
              </div>
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Hành động</span>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{analysis.strategy.action}</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1.5">Lý do chiến thuật</span>
              <p className="text-[11px] text-slate-300 leading-relaxed bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 italic">
                {analysis.rationale}
              </p>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
};

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isTai = data.total >= 11;
    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Outcome</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
            isTai ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
          )}>
            {data.outcome}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total</span>
          <span className="text-lg font-mono font-bold text-white">{data.total}</span>
        </div>
        <div className="flex gap-1.5">
          {[data.dice1, data.dice2, data.dice3].map((d, i) => (
            <div key={i} className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-md text-xs font-bold text-white border border-slate-700">
              {d}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const STORAGE_KEY = "taixiu_sessions";
const BACKTEST_STORAGE_KEY = "taixiu_backtest_config";

const INITIAL_SESSIONS: Session[] = [
  { id: "1", dice: [2, 5, 4], total: 11, outcome: Outcome.TAI, timestamp: Date.now() - 100000 },
  { id: "2", dice: [5, 3, 5], total: 13, outcome: Outcome.TAI, timestamp: Date.now() - 90000 },
  { id: "3", dice: [4, 1, 3], total: 8, outcome: Outcome.XIU, timestamp: Date.now() - 80000 },
  { id: "4", dice: [1, 2, 2], total: 5, outcome: Outcome.XIU, timestamp: Date.now() - 70000 },
  { id: "5", dice: [2, 5, 3], total: 10, outcome: Outcome.XIU, timestamp: Date.now() - 60000 },
  { id: "6", dice: [3, 3, 2], total: 8, outcome: Outcome.XIU, timestamp: Date.now() - 50000 },
  { id: "7", dice: [2, 6, 3], total: 11, outcome: Outcome.TAI, timestamp: Date.now() - 40000 },
  { id: "8", dice: [6, 1, 4], total: 11, outcome: Outcome.TAI, timestamp: Date.now() - 30000 },
  { id: "9", dice: [1, 2, 4], total: 7, outcome: Outcome.XIU, timestamp: Date.now() - 20000 },
  { id: "10", dice: [4, 6, 5], total: 15, outcome: Outcome.TAI, timestamp: Date.now() - 10000 },
];

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
        return INITIAL_SESSIONS;
      }
    }
    return INITIAL_SESSIONS;
  });
  const [newDice, setNewDice] = useState<[string, string, string]>(["", "", ""]);
  const [showHistory, setShowHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<"analysis" | "backtest">("analysis");
  
  // Backtest State
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>(() => {
    const saved = localStorage.getItem(BACKTEST_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved backtest config", e);
      }
    }
    return {
      initialBalance: 1000,
      baseBet: 10,
      strategy: StrategyType.MARTINGALE,
      stopLoss: 0,
      takeProfit: 5000,
      betMultiplier: 1,
    };
  });
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<Record<string, BacktestResult> | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [filterOutcome, setFilterOutcome] = useState<string>('ALL');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [filterTotal, setFilterTotal] = useState<string>('ALL');

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (filterOutcome !== 'ALL' && session.outcome !== filterOutcome) return false;
      if (filterTotal !== 'ALL' && session.total.toString() !== filterTotal) return false;
      
      if (filterDateStart) {
        const start = new Date(filterDateStart).getTime();
        // Set to start of day
        const startOfDay = new Date(start).setHours(0, 0, 0, 0);
        if (session.timestamp < startOfDay) return false;
      }
      if (filterDateEnd) {
        const end = new Date(filterDateEnd).getTime();
        // Set to end of day
        const endOfDay = new Date(end).setHours(23, 59, 59, 999);
        if (session.timestamp > endOfDay) return false;
      }
      
      return true;
    });
  }, [sessions, filterOutcome, filterTotal, filterDateStart, filterDateEnd]);

  const analysis = useMemo(() => analyzeSessions(sessions), [sessions]);

  const [aiCooldown, setAiCooldown] = useState(0);
  const [analysisImage, setAnalysisImage] = useState<{ data: string, mimeType: string, preview: string } | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const data = base64String.split(',')[1];
        setAnalysisImage({ data, mimeType: file.type, preview: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result as string;
                const data = base64String.split(',')[1];
                setAnalysisImage({ data, mimeType: file.type, preview: base64String });
              };
              reader.readAsDataURL(file);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const fetchAiAnalysis = async () => {
    if (!analysisImage || aiCooldown > 0) return;
    setIsAiLoading(true);
    setStructuredAiAnalysis(null);
    setAiInsight(""); // Clear previous insight
    
    // Set a 30-second cooldown
    setAiCooldown(30);
    const cooldownInterval = setInterval(() => {
      setAiCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const result = await getDeepLearningAnalysis({ data: analysisImage.data, mimeType: analysisImage.mimeType });
      setStructuredAiAnalysis(result);
    } catch (e: any) {
      console.error("AI Analysis Error", e);
      setAiInsight(e.message || "Failed to fetch AI insights. Please try again later.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const [aiInsight, setAiInsight] = useState<string>("");
  const [structuredAiAnalysis, setStructuredAiAnalysis] = useState<AiAnalysis | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions to localStorage", e);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(BACKTEST_STORAGE_KEY, JSON.stringify(backtestConfig));
    } catch (e) {
      console.error("Failed to save backtest config to localStorage", e);
    }
  }, [backtestConfig]);

  const addSession = (e: React.FormEvent) => {
    e.preventDefault();
    const dice = newDice.map(d => parseInt(d)) as DiceResult;
    if (dice.some(d => isNaN(d) || d < 1 || d > 6)) return;

    const total = dice.reduce((a, b) => a + b, 0);
    const outcome = total >= 11 ? Outcome.TAI : Outcome.XIU;

    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      dice,
      total,
      outcome,
      timestamp: Date.now(),
    };

    setSessions(prev => [...prev, newSession]);
    setNewDice(["", "", ""]);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleRunBacktest = () => {
    const result = runBacktest(sessions, backtestConfig);
    setBacktestResult(result);
    setComparisonResults(null);
  };

  const handleCompareStrategies = () => {
    const results: Record<string, BacktestResult> = {};
    Object.values(StrategyType).forEach(strategy => {
      results[strategy] = runBacktest(sessions, { ...backtestConfig, strategy });
    });
    setComparisonResults(results);
    setBacktestResult(null);
  };

  const chartData = useMemo(() => {
    return sessions.slice(-20).map((s, idx) => ({
      index: idx + 1,
      sessionId: s.id.slice(0, 4),
      total: s.total,
      outcome: s.outcome,
      dice1: s.dice[0],
      dice2: s.dice[1],
      dice3: s.dice[2],
    }));
  }, [sessions]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="text-emerald-500" />
              Tai Xiu Strategy Analyzer
            </h1>
            <p className="text-slate-400 mt-1">Geometric Analysis & Deep Learning Patterns</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
              <button 
                onClick={() => setActiveTab("analysis")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === "analysis" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                Analysis
              </button>
              <button 
                onClick={() => setActiveTab("backtest")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === "backtest" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                Backtest
              </button>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Sessions</span>
                <span className="text-xl font-mono font-bold text-white">{sessions.length}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Current Trend</span>
                <span className={cn(
                  "text-xl font-mono font-bold",
                  analysis.prediction === Outcome.TAI ? "text-red-500" : 
                  analysis.prediction === Outcome.XIU ? "text-blue-500" : "text-slate-400"
                )}>
                  {analysis.prediction || "SKIP"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === "analysis" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Input & Analysis */}
            <div className="space-y-8">
              {/* Input Form */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  Add New Session
                </h2>
                <form onSubmit={addSession} className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {newDice.map((val, idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Dice {idx + 1}</label>
                        <input
                          type="number"
                          min="1"
                          max="6"
                          value={val}
                          onChange={(e) => {
                            const next = [...newDice];
                            next[idx] = e.target.value;
                            setNewDice(next as [string, string, string]);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                          placeholder="?"
                          required
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                  >
                    Confirm Result
                  </button>
                </form>
              </section>

              {/* Analysis Card */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BarChart3 className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Cycle Analysis (Cầu)
                </h2>
                <div className="space-y-4">
                  <div className="p-5 bg-slate-950/50 rounded-xl border border-slate-800 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <TrendingUp className="w-16 h-16" />
                    </div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Current Cycle</span>
                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                          {analysis.pattern}
                        </h3>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        analysis.confidence > 0.7 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      )}>
                        {Math.round(analysis.confidence * 100)}% Conf.
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-slate-800 pl-3 italic">
                      {analysis.reasoning}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Pattern Strength</span>
                      <span className="text-xs font-mono text-white">{Math.round(analysis.confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${analysis.confidence * 100}%` }}
                        className={cn(
                          "h-full transition-all duration-1000",
                          analysis.confidence > 0.7 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : analysis.confidence > 0.4 ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"
                        )}
                      />
                    </div>
                  </div>

                  {/* Pattern Library Section */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest">Thư Viện Các Loại Cầu</h3>
                    </div>
                    <div className="space-y-1">
                      {PATTERN_GUIDE.map((p) => (
                        <PatternAccordion key={p.id} pattern={p} />
                      ))}
                    </div>
                    <p className="mt-4 text-[10px] text-slate-500 italic text-center">
                      * Hiểu rõ các loại cầu giúp bạn đưa ra quyết định chính xác hơn khi kết hợp với phân tích AI.
                    </p>
                  </div>

                  {/* AI Deep Learning Insight */}
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 relative overflow-hidden">
                    {isAiLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                        </div>
                        <div className="w-full max-w-[240px] h-32 rounded-2xl border-2 border-slate-800 bg-slate-900/50 animate-pulse flex flex-col items-center justify-center gap-2">
                          <div className="w-24 h-2 bg-slate-800 rounded" />
                          <div className="w-32 h-10 bg-slate-800 rounded" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 animate-pulse">
                          AI is thinking deeply...
                        </span>
                        <p className="text-[8px] text-slate-500 text-center max-w-[180px]">
                          Analyzing visual patterns, trends, and table DNA from the provided image.
                        </p>
                      </motion.div>
                    )}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        AI Deep Insight
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={fetchAiAnalysis}
                          disabled={isAiLoading || !analysisImage || aiCooldown > 0}
                          className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAiLoading ? "Analyzing..." : aiCooldown > 0 ? `Wait ${aiCooldown}s` : !analysisImage ? "Upload Image" : "Analyze Image"}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className={cn(
                              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                              isAiLoading ? "bg-emerald-400" : "bg-blue-400"
                            )}></span>
                            <span className={cn(
                              "relative inline-flex rounded-full h-2 w-2",
                              isAiLoading ? "bg-emerald-500" : "bg-blue-500"
                            )}></span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {isAiLoading ? "Processing" : "Live"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Image Upload Area */}
                    <div className="mb-4">
                      {!analysisImage ? (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer group">
                          <div className="flex flex-col items-center justify-center pt-2 pb-2">
                            <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-500 transition-colors mb-2" />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Upload or Paste (Ctrl+V)</p>
                            <p className="text-[8px] text-slate-600 mt-1">Screenshot for visual pattern analysis</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      ) : (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-700">
                          <img 
                            src={analysisImage.preview} 
                            alt="Analysis target" 
                            className="w-full h-full object-cover opacity-60"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                          <div className="absolute bottom-2 left-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Image Loaded</span>
                          </div>
                          <button 
                            onClick={() => setAnalysisImage(null)}
                            className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed min-h-[60px] max-w-none">
                      {structuredAiAnalysis ? (
                        <AiAnalysisDashboard analysis={structuredAiAnalysis} />
                      ) : aiInsight ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs italic">
                          {aiInsight}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                          <Activity className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-[10px] uppercase font-bold tracking-widest">Awaiting Analysis</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dice Frequency (Card Counting) */}
                  {analysis.diceFrequency && (
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 font-bold block mb-3">Dice Distribution (Last 30)</span>
                      <div className="flex justify-between items-end h-12 gap-1">
                        {Object.entries(analysis.diceFrequency).map(([face, count]) => {
                          const values = Object.values(analysis.diceFrequency!) as number[];
                          const max = Math.max(...values);
                          const height = max > 0 ? ((count as number) / max) * 100 : 0;
                          return (
                            <div key={face} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full bg-slate-800 rounded-t-sm relative group">
                                <motion.div 
                                  initial={{ height: 0 }}
                                  animate={{ height: `${height}%` }}
                                  className="bg-blue-500/40 w-full rounded-t-sm"
                                />
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {count}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-600">{face}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Middle & Right Column: Charts & History */}
            <div className="lg:col-span-2 space-y-8">
              {/* Chart Section */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Geometric Line Chart
                  </h2>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-red-500" /> TÀI (11-17)
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" /> XỈU (4-10)
                    </span>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="sessionId" 
                        stroke="#475569" 
                        fontSize={10} 
                        tickMargin={10}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis domain={[3, 18]} ticks={[3, 7, 11, 14, 18]} stroke="#475569" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={10.5} stroke="#334155" strokeDasharray="5 5" label={{ position: 'right', value: 'Threshold', fill: '#475569', fontSize: 10 }} />
                      <ReferenceLine y={7} stroke="#ef4444" strokeOpacity={0.2} label={{ position: 'left', value: 'Support 7', fill: '#ef4444', fontSize: 10, opacity: 0.5 }} />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isTai = payload.total >= 11;
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill={isTai ? "#ef4444" : "#10b981"} 
                              stroke="#0f172a" 
                              strokeWidth={2} 
                            />
                          );
                        }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* History Table */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-500" />
                    Session History
                  </h2>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        if (window.confirm("Are you sure you want to clear all session history?")) {
                          setSessions([]);
                        }
                      }}
                      className="text-xs text-red-500/70 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                    <button 
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {showHistory ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-x-auto"
                    >
                      <div className="p-4 bg-slate-950/30 border-b border-slate-800 flex flex-wrap gap-4 items-end">
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Outcome</label>
                          <select 
                            value={filterOutcome}
                            onChange={(e) => setFilterOutcome(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="ALL">All Outcomes</option>
                            <option value="TAI">TAI (Big)</option>
                            <option value="XIU">XIU (Small)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Total Value</label>
                          <select 
                            value={filterTotal}
                            onChange={(e) => setFilterTotal(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="ALL">All Totals</option>
                            {Array.from({ length: 16 }, (_, i) => i + 3).map(num => (
                              <option key={num} value={num.toString()}>{num}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Start Date</label>
                          <input 
                            type="date"
                            value={filterDateStart}
                            onChange={(e) => setFilterDateStart(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">End Date</label>
                          <input 
                            type="date"
                            value={filterDateEnd}
                            onChange={(e) => setFilterDateEnd(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        {(filterOutcome !== 'ALL' || filterTotal !== 'ALL' || filterDateStart || filterDateEnd) && (
                          <button
                            onClick={() => {
                              setFilterOutcome('ALL');
                              setFilterTotal('ALL');
                              setFilterDateStart('');
                              setFilterDateEnd('');
                            }}
                            className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 rounded-lg transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/50">
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Session</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Dice</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Outcome</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredSessions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">
                                No sessions found matching the filters.
                              </td>
                            </tr>
                          ) : (
                            filteredSessions.slice().reverse().map((s) => (
                              <tr key={s.id} className="hover:bg-slate-800/20 transition-colors group">
                                <td className="px-6 py-4 text-xs font-mono text-slate-400">#{s.id.slice(0, 4)}</td>
                                <td className="px-6 py-4 text-xs text-slate-500">
                                  {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-1">
                                    {s.dice.map((d, i) => (
                                      <span key={i} className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded text-[10px] font-bold text-white">
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-white">{s.total}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                                    s.outcome === Outcome.TAI ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                                  )}>
                                    {s.outcome}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => deleteSession(s.id)}
                                    className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Backtest Config */}
            <div className="lg:col-span-1 space-y-6">
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-emerald-500" />
                  Backtest Config
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Strategy</label>
                    <select 
                      value={backtestConfig.strategy}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, strategy: e.target.value as StrategyType }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      {Object.values(StrategyType).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Initial Balance</label>
                    <input 
                      type="number"
                      value={backtestConfig.initialBalance}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, initialBalance: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Base Bet</label>
                    <input 
                      type="number"
                      value={backtestConfig.baseBet}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, baseBet: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Stop Loss</label>
                    <input 
                      type="number"
                      value={backtestConfig.stopLoss}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, stopLoss: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Take Profit</label>
                    <input 
                      type="number"
                      value={backtestConfig.takeProfit}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, takeProfit: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Bet Multiplier</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={backtestConfig.betMultiplier}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, betMultiplier: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <button 
                      onClick={handleRunBacktest}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                    >
                      Run Simulation
                    </button>
                    <button 
                      onClick={handleCompareStrategies}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-[0.98]"
                    >
                      Compare All Strategies
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Backtest Results */}
            <div className="lg:col-span-3 space-y-6">
              {comparisonResults ? (
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Strategy Comparison
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/50">
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Strategy</th>
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Profit</th>
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Win Rate</th>
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Drawdown</th>
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sharpe</th>
                          <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sortino</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {Object.entries(comparisonResults).map(([strategy, result]) => {
                          const isAi = strategy === StrategyType.DA_CHIEU;
                          return (
                            <tr key={strategy} className={cn(
                              "transition-colors",
                              isAi ? "bg-emerald-500/10 hover:bg-emerald-500/20" : "hover:bg-slate-800/20"
                            )}>
                              <td className="px-6 py-4 text-sm font-bold text-white flex items-center gap-2">
                                {strategy}
                                {isAi && <span className="px-2 py-0.5 rounded text-[8px] uppercase tracking-wider bg-emerald-500 text-slate-950">AI</span>}
                              </td>
                              <td className={cn("px-6 py-4 text-sm font-mono font-bold", result.totalProfit >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {result.totalProfit.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-blue-500">{(result.winRate * 100).toFixed(1)}%</td>
                              <td className="px-6 py-4 text-sm font-mono text-amber-500">{result.maxDrawdown.toLocaleString()}</td>
                              <td className="px-6 py-4 text-sm font-mono text-slate-400">{result.sharpeRatio.toFixed(2)}</td>
                              <td className="px-6 py-4 text-sm font-mono text-slate-400">{result.sortinoRatio.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : backtestResult ? (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Final Balance", value: backtestResult.finalBalance.toLocaleString(), color: backtestResult.totalProfit >= 0 ? "text-emerald-500" : "text-red-500" },
                      { label: "Total Profit", value: (backtestResult.totalProfit >= 0 ? "+" : "") + backtestResult.totalProfit.toLocaleString(), color: backtestResult.totalProfit >= 0 ? "text-emerald-500" : "text-red-500" },
                      { label: "Win Rate", value: (backtestResult.winRate * 100).toFixed(1) + "%", color: "text-blue-500" },
                      { label: "Max Drawdown", value: backtestResult.maxDrawdown.toLocaleString(), color: "text-amber-500" },
                      { label: "Sharpe Ratio", value: backtestResult.sharpeRatio.toFixed(2), color: backtestResult.sharpeRatio > 1 ? "text-emerald-500" : "text-slate-400" },
                      { label: "Sortino Ratio", value: backtestResult.sortinoRatio.toFixed(2), color: backtestResult.sortinoRatio > 1 ? "text-emerald-500" : "text-slate-400" },
                    ].map((stat, i) => (
                      <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-xl">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">{stat.label}</span>
                        <span className={cn("text-xl font-mono font-bold", stat.color)}>{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Profit Chart */}
                  <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Equity Curve
                    </h2>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={backtestResult.steps} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="sessionId" hide />
                          <YAxis stroke="#475569" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '12px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Trade Log */}
                  <section className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-slate-800">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-amber-500" />
                        Simulation Log
                      </h2>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-950 z-10">
                          <tr className="bg-slate-950/50">
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Step</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pred/Act</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Bet</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Result</th>
                            <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {backtestResult.steps.slice().reverse().map((step, i) => (
                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-6 py-4 text-xs font-mono text-slate-400">#{backtestResult.steps.length - i}</td>
                              <td className="px-6 py-4 text-xs">
                                <span className="text-slate-300">{step.prediction}</span>
                                <span className="text-slate-500 mx-1">/</span>
                                <span className="text-slate-300">{step.actual}</span>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-white">{step.betAmount.toLocaleString()}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                                  step.win ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                )}>
                                  {step.win ? "WIN" : "LOSS"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-white text-xs">{step.balance.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-900/30 border border-slate-800 border-dashed rounded-2xl p-12 text-center">
                  <Activity className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Simulation Data</h3>
                  <p className="text-slate-500 max-w-md">
                    Configure your strategy parameters on the left and click "Run Simulation" to see how your strategy would have performed against historical data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
          {[
            { icon: <Info className="w-4 h-4" />, title: "Cầu Bệt", text: "5 ván liên tiếp cùng cửa. Đánh theo cho đến khi gãy." },
            { icon: <TrendingUp className="w-4 h-4" />, title: "Điểm Neo 7", text: "Số 7 là đáy hỗ trợ, thường bật lên 11-13." },
            { icon: <TrendingDown className="w-4 h-4" />, title: "Đỉnh Lỗi", text: "13 -> 11 là tín hiệu rơi sâu sắp tới." },
            { icon: <AlertCircle className="w-4 h-4" />, title: "Cân Bằng", text: "Tỷ lệ 50-50 thường tạo nhịp gãy mới." },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-4 flex gap-3">
              <div className="text-slate-500 mt-1">{item.icon}</div>
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
