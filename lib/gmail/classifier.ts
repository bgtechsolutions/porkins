import "server-only";

import { GoogleGenAI, Type } from "@google/genai";

type Category = { id: string; name: string };

export async function classifyCategory(description: string, subject: string, categories: Category[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || categories.length === 0) return null;

  const ai = new GoogleGenAI({ apiKey });
  const allowed = categories.map((category) => category.name);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Classifique a transação em uma categoria existente. Estabelecimento: ${description.slice(0, 120)}. Assunto: ${subject.slice(0, 120)}. Categorias: ${allowed.join(", ")}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { category: { type: Type.STRING, enum: allowed } },
        required: ["category"],
      },
    },
  });
  const selected = JSON.parse(response.text ?? "{}") as { category?: string };
  return categories.find((category) => category.name === selected.category)?.id ?? null;
}

