import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/environment";
import Groq from "groq-sdk";

class GeminiService {
  private genAI?: GoogleGenerativeAI;
  private groqAI?: Groq;
  private availableModels = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];
  private currentModelIndex = 0;

  constructor() {
    if (config.gemini.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
        console.log("✅ Gemini Service Initialized");
      } catch (error) {
        console.error("❌ Failed to initialize Gemini:", error);
      }
    }

    if (config.groq.apiKey) {
      try {
        this.groqAI = new Groq({ apiKey: config.groq.apiKey });
        console.log("✅ Groq Service Initialized");
      } catch (error) {
        console.error("❌ Failed to initialize Groq:", error);
      }
    }

    if (!this.genAI && !this.groqAI) {
      console.warn("⚠️ No AI services initialized. Please check your API keys.");
    }
  }

  private getCurrentModel() {
    if (!this.genAI) throw new Error("Gemini is not initialized");

    const modelName = this.availableModels[this.currentModelIndex];
    return this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      },
    });
  }

  // ✅ Layout variation helper
  private getRandomLayoutRule(): string {
    const layouts = [
      "Write the post using ONLY short paragraphs. Do NOT use bullet points.",
      "Start with short paragraphs, then use bullet points in the middle, and end with a paragraph.",
      "Start with bullet points, then switch to short paragraphs.",
      "Use one-line sentences with spacing. Avoid long paragraphs.",
      "Mix short paragraphs and bullet points evenly throughout the post."
    ];
    return layouts[Math.floor(Math.random() * layouts.length)];
  }

  async generateSocialMediaPost(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    framework?: string,
    characterLimit: number = 1000
  ): Promise<string[]> {
    if (this.genAI) {
      return this.generateGeminiPost(documentContent, platform, tone, variantCount, framework, characterLimit);
    } else if (this.groqAI) {
      return this.generateGroqPost(documentContent, platform, tone, variantCount, framework, characterLimit);
    } else {
      throw new Error("No AI service available to generate content.");
    }
  }

  async generateGeminiPost(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    framework?: string,
    characterLimit: number = 1000
  ): Promise<string[]> {
    try {
      const prompt = this.buildCleanPrompt(
        documentContent,
        platform,
        tone,
        variantCount,
        framework,
        characterLimit
      );
      const model = this.getCurrentModel();

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return this.parseResponse(text, variantCount);
    } catch (error: any) {
      if (this.currentModelIndex < this.availableModels.length - 1) {
        this.currentModelIndex++;
        return this.generateGeminiPost(documentContent, platform, tone, variantCount, framework, characterLimit);
      }

      if (this.groqAI) {
        return this.generateGroqPost(documentContent, platform, tone, variantCount, framework, characterLimit);
      }

      throw error;
    }
  }

  async generateGroqPost(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    framework?: string,
    characterLimit: number = 1000
  ): Promise<string[]> {
    if (!this.groqAI) throw new Error("Groq not initialized");

    const prompt = this.buildCleanPrompt(
      documentContent,
      platform,
      tone,
      variantCount,
      framework,
      characterLimit
    );

    const chatCompletion = await this.groqAI.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "openai/gpt-oss-20b",
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    return this.parseResponse(text, variantCount);
  }

  private buildCleanPrompt(
    documentContent: string,
    platform: string,
    tone: string,
    variantCount: number,
    framework?: string,
    characterLimit: number = 1000
  ): string {
    const truncatedContent = documentContent.substring(0, 2000);

    const layoutRule = this.getRandomLayoutRule();

    // ✅ DYNAMIC WORD COUNT based on character limit
    // Average: 5 characters per word
    const minWords = Math.floor(characterLimit / 5.5);
    const maxWords = Math.ceil(characterLimit / 4.5);
    const wordCountRule = `Write between ${minWords}–${maxWords} words.`;

    // ✅ CHARACTER LIMIT (User-configurable: 500-2500 characters)
    const characterCountRule = `Maximum ${characterLimit} characters.`;

    return `
You are an expert AI social media content creator who writes viral LinkedIn posts.

Platform: ${platform}
Tone: ${tone}
Framework: ${framework ?? "Auto"}

Reference Document:
${truncatedContent}

STEP 4 — FORMAT FOR LINKEDIN

WORD COUNT RULE (STRICT):
${wordCountRule}

CHARACTER LIMIT RULE (STRICT):
${characterCountRule}

LAYOUT VARIATION RULE (MANDATORY FOR THIS POST):
${layoutRule}

- Use short, clear paragraphs, 1-2 lines each, for readability
- Maintain natural flow — no section headings
- Use emojis naturally (🔥 💡 🚀 👇 💬 ✅)
- Keep the post scroll-friendly
- End with a reflective question
- Add 4–5 relevant hashtags
- Output ONLY the post
- Separate multiple posts with ===POST===

Generate ${variantCount} posts now.
`;
  }

  private parseResponse(text: string, expectedCount: number): string[] {
    return text
      .split("===POST===")
      .map(p => p.trim())
      .filter(p => p.length > 30)
      .slice(0, expectedCount);
  }

  async generateWithRetry(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    maxRetries: number = 2,
    framework?: string,
    characterLimit: number = 1000
  ): Promise<string[]> {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const posts = await this.generateSocialMediaPost(
          documentContent,
          platform,
          tone,
          variantCount,
          framework,
          characterLimit
        );
        if (posts.length) return posts;
      } catch { }
    }
    return this.getFallbackContent(platform, tone, variantCount);
  }

  private getFallbackContent(
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number
  ): string[] {
    return ["Content generation failed. Please try again."].slice(0, variantCount);
  }

  async testConnection(): Promise<boolean> {
    if (!this.genAI) return false;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      await model.generateContent('Say "OK"');
      return true;
    } catch {
      return false;
    }
  }
}

export default new GeminiService();
