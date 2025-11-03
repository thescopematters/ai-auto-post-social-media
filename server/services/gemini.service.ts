import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/environment";

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private availableModels = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  private currentModelIndex = 0;

  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }

    try {
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    } catch (error) {
      console.error("Failed to initialize Gemini:", error);
      throw error;
    }
  }

  private getCurrentModel() {
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

  async generateSocialMediaPost(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    framework?: string
  ): Promise<string[]> {
    try {
      const prompt = this.buildCleanPrompt(
        documentContent,
        platform,
        tone,
        variantCount,
        framework
      );
      const model = this.getCurrentModel();

      console.log(`🚀 Generating ${variantCount} posts with framework: ${framework || 'auto'}`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const posts = this.parseResponse(text, variantCount);
      return posts;
    } catch (error: any) {
      console.error(`❌ Gemini API error (Model: ${this.availableModels[this.currentModelIndex]}):`, error.message);

      if (this.currentModelIndex < this.availableModels.length - 1) {
        this.currentModelIndex++;
        return this.generateSocialMediaPost(
          documentContent,
          platform,
          tone,
          variantCount,
          framework
        );
      }

      console.error("❌ All models failed. Using fallback content.");
      throw new Error(`All Gemini models failed: ${error.message}`);
    }
  }

  private buildCleanPrompt(
    documentContent: string,
    platform: string,
    tone: string,
    variantCount: number,
    framework?: string
  ): string {
    const truncatedContent = documentContent.substring(0, 2000);

    const frameworkPrompts = {
      hvcta: `HOOK: Start with an attention-grabbing statement
VALUE: Provide valuable insights from the document  
CALL TO ACTION: Encourage comments/shares`,
      
      pas: `PROBLEM: Identify the main problem from the document
AGITATE: Make the problem feel urgent and relatable
SOLUTION: Present the solution from the document`,
      
      sla: `STORY: Share a brief personal/professional story from the document
LESSON: Extract the key lesson learned  
APPLICATION: Show how to apply this lesson`,
      
      mrs: `MISTAKE: Share a mistake or challenge from the document
REALIZATION: What was learned or realized
SHIFT: How things changed or improved`,
      
      cms: `Tell a short chronological story using time markers
Structure: Beginning → Middle → End
Keep it concise and engaging`,
      
      htof: `HOT TAKE: Present a bold opinion or perspective
EXPLANATION: Explain why this perspective matters  
DISCUSSION: Invite others to share their thoughts`,
      
      auto: `Use the most appropriate framework for the content
Focus on engagement and value`
    };

    const frameworkInstruction = framework && frameworkPrompts[framework as keyof typeof frameworkPrompts] 
      ? `\nFRAMEWORK: ${framework.toUpperCase()}\nSTRUCTURE:\n${frameworkPrompts[framework as keyof typeof frameworkPrompts]}`
      : '\nFRAMEWORK: Auto (AI will choose the best structure)';

    return `
Create ${variantCount} social media posts for ${platform} based on the content below.

CONTENT:
${truncatedContent}

PLATFORM: ${platform}
TONE: ${tone}
VARIATIONS: ${variantCount}${frameworkInstruction}

IMPORTANT FORMATTING RULES:
- DO NOT number the posts (no "POST 1", "2", "3")
- DO NOT use markdown formatting (no **bold**, no headers)
- Create clean, plain text posts
- Each post should be unique and engaging
- Use appropriate hashtags
- Keep it professional
- Make it valuable for the audience

FORMAT:
Separate each post with "===POST==="

Now generate ${variantCount} ${platform} posts:`;
  }

  private parseResponse(text: string, expectedCount: number): string[] {
    let cleanText = text
      .replace(/\*\*POST\s*\d+\*\*/gi, '') 
      .replace(/POST\s*\d+\s*[:-]?\s*/gi, '') 
      .replace(/^#\s?POST\s*\d+.*$/gim, '') 
      .replace(/^Variation\s*\d+.*$/gim, '')
      .trim();

    const delimiters = ["===POST===", "---POST---", "POST:", "Variation"];
    let posts: string[] = [];

    for (const delimiter of delimiters) {
      posts = cleanText
        .split(delimiter)
        .map((post) => post.trim())
        .filter((post) => {
          return (
            post.length > 20 &&
            !post.toLowerCase().includes("sorry") &&
            !post.toLowerCase().includes("i cannot") &&
            !post.toLowerCase().includes("as an ai") &&
            !post.match(/^(post\s*\d+|variation\s*\d+)/i)
          );
        });

      if (posts.length >= expectedCount) {
        break;
      }
    }

    if (posts.length === 0) {
      posts = cleanText
        .split('\n\n')
        .map((post) => post.trim())
        .filter((post) => 
          post.length > 30 &&
          !post.match(/^(post\s*\d+|variation\s*\d+)/i)
        )
        .slice(0, expectedCount);
    }

    posts = posts.map(post => {
      return post
        .replace(/^\d+[\.\)]\s*/, '') 
        .replace(/^[\*\-#]\s*/, '')
        .trim();
    });

    if (posts.length === 0) {
      posts = [cleanText.substring(0, 500)];
    }
    return posts.slice(0, expectedCount);
  }

  async generateWithRetry(
    documentContent: string,
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number = 3,
    maxRetries: number = 2,
    framework?: string 
  ): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const posts = await this.generateSocialMediaPost(
          documentContent,
          platform,
          tone,
          variantCount,
          framework
        );

        if (posts && posts.length > 0) {
          return posts;
        }

        console.warn(
          `Attempt ${attempt + 1}: Generated ${
            posts?.length || 0
          } posts. Retrying...`
        );
      } catch (error: unknown) {
        lastError = error as Error;
        console.error(
          `Attempt ${attempt + 1} failed:`,
          (error as Error).message
        );

        if (attempt < maxRetries) {
          const delay = 1000 * (attempt + 1);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.warn("⚠️ All retry attempts failed, returning fallback content");
    return this.getFallbackContent(platform, tone, variantCount);
  }

  private getFallbackContent(
    platform: "linkedin" | "twitter",
    tone: string,
    variantCount: number
  ): string[] {
    const templates = {
      linkedin: {
        professional: [
          "Based on our analysis, we've identified key growth opportunities in the current market landscape. Strategic planning and innovation are crucial for sustainable success. #BusinessStrategy #Growth #ProfessionalInsights",
          "Thought leadership requires deep industry understanding and forward-thinking approaches. Our latest findings highlight emerging trends that demand attention. #ThoughtLeadership #Innovation #IndustryTrends",
          "Professional development is key in today's dynamic business environment. Continuous learning and adaptation separate industry leaders from followers. #ProfessionalGrowth #Learning #BusinessExcellence",
        ],
        casual: [
          "Hey team! Just went through some fascinating insights that could really help us level up our strategy. Who's ready to innovate? 🚀 #TeamWork #Innovation #BusinessCasual",
          "Quick thought: Sometimes the best opportunities are hidden in plain sight. Our latest review uncovered some gems worth exploring! 💎 #BusinessTips #Opportunity #CasualChat",
          "Love seeing how small changes can make big impacts! Our analysis shows some simple tweaks that could drive major results. #SmallWins #BigImpact #BusinessGrowth",
        ],
      },
      twitter: {
        professional: [
          "Key insights from our latest analysis: Strategic alignment + innovation = sustainable growth. Essential reading for leaders. #Business #Strategy #Leadership",
          "Data-driven decisions are transforming industries. Our findings highlight actionable insights for forward-thinking organizations. #DataAnalytics #BusinessIntelligence",
          "Professional excellence starts with continuous improvement. Latest research reveals patterns of high-performing teams. #ProfessionalDevelopment #Excellence",
        ],
        casual: [
          "Just uncovered some cool insights! Simple changes, big impacts. Who's excited to try something new? 😊 #BusinessTips #Growth #Innovation",
          "Quick update: Our research shows interesting trends emerging. Time to adapt and thrive! 💪 #Trends #Business #Update",
          "Fun fact from our analysis: The most successful teams embrace change. How's your team adapting? 🤔 #TeamWork #ChangeManagement",
        ],
      },
    };

    const toneKey: "professional" | "casual" =
      tone === "casual" ? "casual" : "professional";
    const posts =
      templates[platform][toneKey] || templates.linkedin.professional;
    return posts.slice(0, variantCount);
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash" 
      });
      const result = await model.generateContent('Say "OK" if working.');
      const response = await result.response;
      return true;
    } catch (error) {
      console.error("❌ Gemini connection test failed:", error);
      return false;
    }
  }
}

export default new GeminiService();