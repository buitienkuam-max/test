import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Session, AiAnalysis } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

export async function getDeepLearningAnalysis(imageData: { data: string, mimeType: string }): Promise<AiAnalysis> {
  if (!apiKey) {
    throw new Error("AI analysis unavailable: API key missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Analyze the provided image of a Tai Xiu (Big/Small) game table and provide a sophisticated strategy insight.
    Tai Xiu Rules: Total 3-10 is XIU (Small), 11-18 is TAI (Big).
    
    Tasks:
    1. IMAGE RECOGNITION: Extract the recent history of outcomes (TAI/XIU), dice totals, and any visible pattern charts from the image.
    2. PATTERN ANALYSIS (PHÂN TÍCH CẦU): Identify specific patterns like "Bệt" (long streaks), "Cầu 1-1", "Cầu 2-2", "Cầu 3-1", etc.
    3. REPEATED NUMBERS (SỐ LẶP LẠI): Look for repeated dice values or total scores that appear frequently in the recent sessions shown in the image.
    4. TREND CHART (BIỂU ĐỒ LÊN XUỐNG): Analyze the "up and down" movement of the total scores. Is it trending upwards (towards TAI), downwards (towards XIU), or oscillating?
    5. Confidence Scoring: Assign a percentage (0-100%) to your final prediction based on the clarity of the visual evidence.
    6. FINAL VERDICT: Provide the definitive TAI, XIU, or SKIP.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageData.data,
              mimeType: imageData.mimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prediction: { type: Type.STRING, description: "TAI, XIU, or SKIP" },
            summary: { type: Type.STRING, description: "Brief summary of visual recognition" },
            patterns: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                status: { type: Type.STRING },
                details: { type: Type.STRING }
              },
              required: ["type", "status", "details"]
            },
            frequency: {
              type: Type.OBJECT,
              properties: {
                hotspots: { type: Type.STRING },
                repeated: { type: Type.STRING }
              },
              required: ["hotspots", "repeated"]
            },
            trends: {
              type: Type.OBJECT,
              properties: {
                direction: { type: Type.STRING },
                amplitude: { type: Type.STRING }
              },
              required: ["direction", "amplitude"]
            },
            strategy: {
              type: Type.OBJECT,
              properties: {
                confidence: { type: Type.NUMBER },
                action: { type: Type.STRING },
                risk: { type: Type.STRING }
              },
              required: ["confidence", "action", "risk"]
            },
            rationale: { type: Type.STRING }
          },
          required: ["prediction", "summary", "patterns", "frequency", "trends", "strategy", "rationale"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI.");
    }

    return JSON.parse(response.text) as AiAnalysis;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
