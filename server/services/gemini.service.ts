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
   You are an expert AI social media content creator who specializes in generating viral, high-engagement, and human-sounding posts for LinkedIn. 
Your writing style is visual, value-driven, and feels like a real human sharing something genuinely useful—not marketing copy.

Your task is to write a LinkedIn post only, no introductions, explanations, or extra commentary based on the following inputs:
Platform:${platform}
Tone: ${tone}                // e.g., Professional, Casual, Thought Leader, Educational, Promotional  
Framework:${frameworkInstruction}      // e.g., SLA, PAS, MRS, CMS, HVCTA, HTOF  
Reference Document: ${truncatedContent}

STEP 1 — UNDERSTAND CONTEXT

1. Read and understand the provided reference document carefully.  
2. Extract the main topic or insight — identify the key message or takeaway from the document.  
3. Based on the extracted topic, automatically decide the most suitable persona:
   - Leadership, innovation, strategy → Thought Leader  
   - Teaching, explaining, simplifying → Educator  
   - Storytelling or life lessons → Storyteller  
   - Startup or personal experiences → Founder  
   - Marketing, growth, or promotion → Marketer  
   - Motivational or reflective → Mentor  
(Summarize this internally — do not output it.)
4. Automatically determine the most suitable Post Type
   - Post Type can be inferred as Storytelling, Technical, Product Launch, Educational Insight, Comparison, or Thought Leadership — based on the reference document’s content and tone.  
   - The post length must be between 300-350 words — not shorter, not longer.

STEP 2 — APPLY FRAMEWORK LOGIC
Use the chosen ${framework} to structure the internal logic of the post. Do not label sections in the output:
- SLA (Story → Lesson → Application)
  Start with a short, emotional or relatable story → share a lesson → end with a practical takeaway.  

- PAS (Problem → Agitate → Solution)
  Highlight a common problem → describe the consequences → provide a solution or insight.  

- MRS (Mistake → Realization → Shift)
  Describe a mistake → share a realization → end with the mindset or strategy shift.  

- CMS (Chronological Micro-Story)
  Tell a brief, time-based story: setup → challenge → action → outcome → reflection.  

- HVCTA (Hook → Value → Call To Action)
  Begin with a scroll-stopping hook → deliver clear value → end with a call to action or reflection.  

- HTOF (Hot Take / Opinion Framework)
  Share a bold opinion → back it up with reasoning or data → close with a reflective takeaway or question.

STEP 3— APPLY PERSONA + TONE
- Write in the voice of the selected persona (thought leader, educator, etc.).  
- Adjust formality and rhythm according to the ${tone} (Professional, Casual, etc.).  
- Make it feel authentic, human, and emotionally resonant.  
- Avoid robotic or overly generic phrasing.  
- Make it sound like a real person is talking directly to their LinkedIn audience — with warmth, personality, and natural flow.
- Use natural pauses, conversational rhythm, and subtle emotion to create an approachable and believable tone.  
- Keep the voice confident yet human — as if the author genuinely believes in what they're saying.

FOR TECHNICAL OR EDUCATIONAL POSTS:
- Focus on clarity, simplicity, and real-world usefulness.  
- Use short lines, spacing, and bullet points for scannability.  
- When explaining technical concepts (e.g., AI models, frameworks, tools, data formats), emphasize “why it matters” and “what impact it creates (speed, cost, accuracy, efficiency, etc.).  
- Include light emoji indicators (💡 ✅ ⚡ 🚀 👇) when they naturally fit the rhythm.  
- If comparing or explaining, highlight measurable improvements (e.g., “50% fewer tokens”, “2x faster processing”).  
- End with a line that sparks curiosity or encourages discussion (“Next up…”, “Would you try this?”, “What's your take?”).

FOR EMOTIONAL OR STORYTELLING POSTS:
- Use emotional realism — small relatable moments, human reflections, or lessons learned.  
- Balance logic with empathy — make the reader feel seen or understood.
- Incorporate contrast patterns (e.g., “It's not arrogance — it's awareness. It's not rebellion — it's evolution.”).  
- Alternate between narrative and reflection. Let the story breathe.  
- End each emotional section with a sentence that adds meaning, not just information.  
- Use rhythm and pacing like spoken storytelling — occasional one-liners, pauses, and rhetorical questions.  
- Sound like a human sharing an honest realization, not delivering a lecture.

STEP 4 — FORMAT FOR LINKEDIN
- Use short, clear paragraphs, 1-2 lines each, for readability.  
- Start with a strong hook in the first 2 lines to grab attention.  
- Maintain natural flow — no section headings like “Hook”, “Lesson”, or “CTA”.  
- Keep the tone conversational and engaging, not academic or formal.  
- Use emojis naturally throughout the post to add emotion, energy, and visual rhythm (🔥 💡 🚀 👇 💬 ✅).  
- Include bullet points (• or - or 1) for clarity and scannability wherever useful.  
- Ensure the structure feels scroll-friendly and visually appealing.  

FORMAT ENHANCEMENTS:
- Each paragraph should convey one clear idea.  
- Use emojis to break text monotony and highlight value points.  
- Prefer bullet points or short lists for key takeaways.  
- Maintain whitespace for readability (1 line space between paragraphs).  
- Use contrast or parallel phrasing to emphasize shifts (e.g., “Old way vs New way”, “Before vs After”).  
- Start with an emotive or situational hook when the story involves human experience (e.g., “I still remember my first day at work…”).  

STEP 5 — FINAL TOUCHES

- End with a reflective question or call to action that encourages engagement.  
- Add 3-5 relevant hashtags related to the topic and audience.  
- Ensure the final output reads like a real viral LinkedIn post — not a structured essay.  
- Do not mention the framework, tone, or persona explicitly in the output.  
- Make sure it feels like it was written by a real, relatable professional — not an AI.

ADDITIONAL OPTIMIZATION:
- Balance insight + relatability + action.  
- Avoid buzzwords or filler lines — focus on clarity and real impact.  
- Keep it scroll-stopping, visual, and designed for quick reading.  
- Always align the tone with the inferred post type (storytelling ≠ same tone as technical explainer).  
- For emotional or leadership posts, ensure a meaningful resolution — close with reflection, awareness, or purpose.  
- End with a question that invites personal reflection or leadership growth, not just engagement.  
- Use emotional closure — make the reader pause and feel the takeaway.  
- “Always use more bullet points and emojis throughout the post” to increase readability, engagement, and visual flow.

✅ Final Output:
- Output only the final LinkedIn post—no notes, explanations, or introductory lines.  
-  The final output must read like a real, viral LinkedIn post that sounds natural, scroll-stopping, and engagement-optimized— human, emotional, and visually engaging with clear bullet points, contextual emojis, ensuring total length is 300–350 words, and with 4 to 5 relevant hashtags related to the topic and audience.
- It should sound like a real person is talking directly to their LinkedIn audience — with warmth, personality, and natural flow.
 


`
// Create ${variantCount} social media posts for ${platform} based on the content below.

// CONTENT:
// ${truncatedContent} 

// PLATFORM: ${platform}
// TONE: ${tone}
// VARIATIONS: ${variantCount}${frameworkInstruction}

// IMPORTANT FORMATTING RULES:
// - DO NOT number the posts (no "POST 1", "2", "3")
// - DO NOT use markdown formatting (no **bold**, no headers)
// - Create clean, plain text posts
// - Each post should be unique and engaging
// - Use appropriate hashtags
// - Keep it professional
// - Make it valuable for the audience

// FORMAT:
// Separate each post with "===POST==="

// Now generate ${variantCount} ${platform} posts:;
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