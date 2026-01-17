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
    characterLimit: number = 1000,
    isTopic: boolean = false
  ): Promise<string[]> {
    if (this.genAI) {
      return this.generateGeminiPost(documentContent, platform, tone, variantCount, framework, characterLimit, isTopic);
    } else if (this.groqAI) {
      return this.generateGroqPost(documentContent, platform, tone, variantCount, framework, characterLimit, isTopic);
    } else {
      throw new Error("No AI service available to generate content.");
    }
  }

  async generateIdeas(role: string): Promise<string[]> {
    if (!this.genAI && !this.groqAI) throw new Error("AI service not initialized");

    const currentTime = new Date().toLocaleString();
    const prompt = `
      # PERSONA: Elite Content Architect for High-Authority Social Platforms
      # TARGET ROLE: ${role}
      # ANALYSIS CONTEXT: 2025-2026 Industry Landscape

      # MISSION
      Generate 10 "Spiky Point of View" (SPOV) post premises. An SPOV is a perspective that is unique, counter-intuitive, and highly defensible. It's not just an opinion; it's a professional stance that positions a ${role} as a Tier-1 expert.

      # STRATEGIC CONTENT PILLARS
      - [THE SPOV]: Challenge a specific industry dogma that everyone else takes for granted.
      - [THE SYSTEM]: Break down a high-leverage "Secret Sauce" workflow or technical logic.
      - [THE HARD TRUTH]: Expose an uncomfortable reality about the ${role} profession that others are too afraid to post.
      - [THE STACK]: A hyper-specific combination of AI tools and manual logic that creates a 10x multiplier.
      - [THE PREDICTION]: A high-stakes forecast on where ${role} is delegating its human value to AI.

      # EXECUTION RULES
      - TARGET AUDience: Peers, CxOs, and high-value clients. 
      - TONE: Professional but punchy. Cut all "adjective fluff" (no "transformative," "game-changing," or "excited to share").
      - SPECIFICITY: Mention real-world scenarios, metrics, or technical nuances.
      - FORMAT: "[HOOK] — [SPOV / VALUE PROPOSITION]"

      # OUTPUT
      - Return EXACTLY 10 numbered items.
      - Each item must be a single, potent line.
      - NO intro/outro text.
    `;

    try {
      let text = "";
      if (this.genAI) {
        const model = this.getCurrentModel();
        const result = await model.generateContent(prompt);
        text = result.response.text();
      } else {
        const chatCompletion = await this.groqAI!.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "openai/gpt-oss-20b",
        });
        text = chatCompletion.choices[0]?.message?.content || "";
      }

      return text
        .split("\n")
        .map(line => line.replace(/^\d+\.\s*/, "").trim())
        .filter(line => line.length > 5)
        .slice(0, 10);
    } catch (error) {
      console.error("Error generating ideas:", error);
      return [];
    }
  }

  async generateGeminiPost(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    framework?: string,
    characterLimit: number = 1000,
    isTopic: boolean = false
  ): Promise<string[]> {
    try {
      const prompt = this.buildCleanPrompt(
        documentContent,
        platform,
        tone,
        variantCount,
        framework,
        characterLimit,
        isTopic
      );
      const model = this.getCurrentModel();

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return this.parseResponse(text, variantCount);
    } catch (error: any) {
      if (this.currentModelIndex < this.availableModels.length - 1) {
        this.currentModelIndex++;
        return this.generateGeminiPost(documentContent, platform, tone, variantCount, framework, characterLimit, isTopic);
      }

      if (this.groqAI) {
        return this.generateGroqPost(documentContent, platform, tone, variantCount, framework, characterLimit, isTopic);
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
    characterLimit: number = 1000,
    isTopic: boolean = false
  ): Promise<string[]> {
    if (!this.groqAI) throw new Error("Groq not initialized");

    const prompt = this.buildCleanPrompt(
      documentContent,
      platform,
      tone,
      variantCount,
      framework,
      characterLimit,
      isTopic
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
    characterLimit: number = 1000,
    isTopic: boolean = false
  ): string {
    const sourceContent = isTopic
      ? `Topic/Idea: ${documentContent}`
      : `Reference Document Content:\n${documentContent.substring(0, 2000)}`;

    const layoutRule = this.getRandomLayoutRule();

    // ✅ DYNAMIC WORD COUNT based on character limit
    // Adjusted ratio: ~5.5-6.5 characters per word for high quality LinkedIn content
    const minWords = Math.floor(characterLimit / 6.5);
    const maxWords = Math.floor(characterLimit / 5.2);
    const wordCountRule = `Write between ${minWords}–${maxWords} words.`;

    // ✅ CHARACTER LIMIT (User-configurable: 500-2500 characters)
    const characterCountRule = `TARGET LENGTH: Aim to get as close to ${characterLimit} characters as possible without exceeding it. HARD MAXIMUM: ${characterLimit} characters.`;

    return `
You are an expert AI social media content creator who writes viral LinkedIn posts.

Platform: ${platform}
Tone: ${tone}
Framework: ${framework ?? "Auto"}

${sourceContent}

STEP 4 — FORMAT FOR LINKEDIN

WORD COUNT RULE:
${wordCountRule}

CHARACTER LIMIT RULE (FORCED):
${characterCountRule}

LAYOUT VARIATION RULE (MANDATORY FOR THIS POST):
${layoutRule}

- Use short, clear paragraphs, 1-2 lines each, for readability
- Maintain natural flow — no section headings
- Use emojis naturally (🔥 💡 🚀 👇 💬 ✅)
- Keep the post scroll-friendly
- End with a reflective question
- Add 4–5 relevant hashtags
- IMPORTANT: You MUST stay under the character limit but aim to provide as much value as possible up to that limit.
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
    characterLimit: number = 1000,
    isTopic: boolean = false
  ): Promise<string[]> {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const posts = await this.generateSocialMediaPost(
          documentContent,
          platform,
          tone,
          variantCount,
          framework,
          characterLimit,
          isTopic
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
