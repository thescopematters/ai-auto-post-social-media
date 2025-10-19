import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import logger from '../config/logger';

interface ContentGenerationOptions {
  platform: 'linkedin' | 'twitter';
  tone: 'professional' | 'casual' | 'thought_leader' | 'educational' | 'promotional';
  sourceContent: string;
  variantCount?: number;
  includeHashtags?: boolean;
  targetAudience?: string;
}

interface GeneratedContent {
  content: string;
  hashtags: string[];
  score: number;
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isSandbox: boolean = process.env.GEMINI_SANDBOX_MODE === 'true';
  private apiKey: string | undefined;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (this.isSandbox || !this.apiKey) {
      logger.info('Gemini Service running in SANDBOX mode - using mock responses');
      this.isSandbox = true;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-pro',
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      logger.info('Gemini Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini Service:', error);
      this.isSandbox = true;
    }
  }

  async generateContent(options: ContentGenerationOptions): Promise<GeneratedContent[]> {
    if (this.isSandbox) {
      return this.mockGenerateContent(options);
    }

    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = this.buildPrompt(options);
    const variantCount = options.variantCount || 3;

    try {
      const results: GeneratedContent[] = [];

      for (let i = 0; i < variantCount; i++) {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const generated = this.parseGeneratedContent(text, options.platform);
        results.push(generated);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`Generated ${results.length} content variants using Gemini AI`);
      return results;
    } catch (error) {
      logger.error('Gemini content generation error:', error);
      throw new Error('Failed to generate content with AI');
    }
  }

  async improveContent(content: string, feedback: string): Promise<string> {
    if (this.isSandbox) {
      return `${content}\n\nImproved based on: ${feedback}`;
    }

    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = `Improve the following social media post based on this feedback: "${feedback}"\n\nOriginal post:\n${content}\n\nProvide only the improved version without explanations.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      logger.error('Content improvement error:', error);
      throw new Error('Failed to improve content');
    }
  }

  async generateHashtags(content: string, count: number = 5): Promise<string[]> {
    if (this.isSandbox) {
      return ['AI', 'ContentMarketing', 'SocialMedia', 'Automation', 'DigitalMarketing'].slice(0, count);
    }

    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = `Generate ${count} relevant hashtags for the following social media post. Return only the hashtags without the # symbol, one per line:\n\n${content}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const hashtags = text
        .split('\n')
        .map(h => h.trim().replace('#', ''))
        .filter(h => h.length > 0)
        .slice(0, count);

      return hashtags;
    } catch (error) {
      logger.error('Hashtag generation error:', error);
      return [];
    }
  }

  async scoreContent(content: string, platform: string): Promise<number> {
    if (this.isSandbox) {
      return Math.random() * 3 + 7;
    }

    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = `Rate the following ${platform} post on a scale of 1-10 for engagement potential. Consider clarity, call-to-action, emotional appeal, and platform best practices. Return only a single number:\n\n${content}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const scoreText = response.text().trim();
      const score = parseFloat(scoreText);

      return isNaN(score) ? 7.0 : Math.min(10, Math.max(1, score));
    } catch (error) {
      logger.error('Content scoring error:', error);
      return 7.0;
    }
  }

  private buildPrompt(options: ContentGenerationOptions): string {
    const { platform, tone, sourceContent, includeHashtags = true, targetAudience } = options;

    const platformSpecs = platform === 'linkedin'
      ? 'LinkedIn (max 3000 characters, professional tone, can use emojis sparingly)'
      : 'Twitter (max 280 characters, concise, engaging)';

    const toneGuide = {
      professional: 'formal and business-focused',
      casual: 'friendly and conversational',
      thought_leader: 'insightful and authoritative',
      educational: 'informative and teaching-oriented',
      promotional: 'persuasive and action-oriented',
    }[tone];

    let prompt = `Create an engaging ${platform} post based on the following content.
Style: ${toneGuide}
Platform: ${platformSpecs}

Source content:
${sourceContent}

Requirements:
- Make it ${toneGuide}
- Optimize for ${platform} best practices
- Include a clear call-to-action or thought-provoking question
- Use line breaks for readability
`;

    if (targetAudience) {
      prompt += `- Target audience: ${targetAudience}\n`;
    }

    if (includeHashtags && platform === 'linkedin') {
      prompt += `- Include 3-5 relevant hashtags at the end\n`;
    } else if (includeHashtags && platform === 'twitter') {
      prompt += `- Include 2-3 relevant hashtags (remember the 280 char limit)\n`;
    }

    prompt += `\nProvide only the post content without any meta-commentary or explanations.`;

    return prompt;
  }

  private parseGeneratedContent(text: string, platform: string): GeneratedContent {
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;

    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1]);
    }

    const content = text.trim();
    const characterLimit = platform === 'linkedin' ? 3000 : 280;
    const truncatedContent = content.length > characterLimit
      ? content.substring(0, characterLimit - 3) + '...'
      : content;

    const score = this.calculateQualityScore(truncatedContent, platform, hashtags.length);

    return {
      content: truncatedContent,
      hashtags,
      score,
    };
  }

  private calculateQualityScore(content: string, platform: string, hashtagCount: number): number {
    let score = 7.0;

    if (content.includes('?')) score += 0.5;
    if (content.match(/[!.?]$/)) score += 0.3;

    if (platform === 'linkedin') {
      if (content.length > 500 && content.length < 1500) score += 0.5;
      if (hashtagCount >= 3 && hashtagCount <= 5) score += 0.4;
      if (content.includes('\n\n')) score += 0.3;
    } else if (platform === 'twitter') {
      if (content.length > 150 && content.length < 250) score += 0.5;
      if (hashtagCount >= 1 && hashtagCount <= 3) score += 0.4;
    }

    const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 0 && emojiCount <= 3) score += 0.3;

    return Math.min(10, Math.max(1, score));
  }

  private mockGenerateContent(options: ContentGenerationOptions): GeneratedContent[] {
    const { platform, tone, variantCount = 3 } = options;

    const templates = {
      linkedin: [
        `🚀 Exciting insights from the latest industry trends!\n\nWe've discovered that companies embracing innovation see remarkable growth. The key isn't just adopting new technology—it's about empowering teams to think differently and drive real value.\n\nWhat strategies have worked best for your organization?\n\n#Innovation #BusinessGrowth #Leadership #DigitalTransformation #Strategy`,
        `💡 Here's what we learned after analyzing market data:\n\n✅ Authenticity drives engagement\n✅ Value-first approach wins customers\n✅ Consistency builds trust\n✅ Community creates loyalty\n\nThe future belongs to brands that genuinely connect with their audience. Are you ready to make that shift?\n\n#Marketing #BrandStrategy #CustomerExperience`,
        `Just wrapped up an amazing project that reinforced a crucial lesson:\n\nSuccess isn't about having all the answers—it's about asking the right questions, empowering your team, and being willing to adapt quickly.\n\nIn today's fast-paced environment, agility is everything. What's your approach to staying nimble?\n\n#BusinessStrategy #TeamWork #Agility`,
      ],
      twitter: [
        `🔥 Innovation isn't about tools—it's about mindset.\n\nCompanies that empower their teams to think differently are the ones winning today.\n\nWhat's your take?\n\n#Innovation #Leadership`,
        `The data is clear:\n\n✅ Authenticity > Perfection\n✅ Value > Volume\n✅ Community > Reach\n\nWhat are you prioritizing?\n\n#Marketing #Strategy`,
        `Hot take: The best strategy is the one you can execute consistently.\n\nStop chasing perfection. Start shipping.\n\n#Business #Startups`,
      ],
    };

    const selectedTemplates = templates[platform];
    const results: GeneratedContent[] = [];

    for (let i = 0; i < variantCount; i++) {
      const template = selectedTemplates[i % selectedTemplates.length];
      const parsed = this.parseGeneratedContent(template, platform);
      results.push(parsed);
    }

    logger.info(`SANDBOX: Generated ${results.length} mock content variants`);
    return results;
  }
}

export default new GeminiService();
