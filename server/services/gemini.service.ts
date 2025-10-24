import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/environment';
import logger from '../config/logger';

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!config.gemini.apiKey) {
      logger.warn('GEMINI_API_KEY is not set. AI content generation will fail.');
    }
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateSocialMediaPost(
    documentContent: string,
    platform: 'linkedin' | 'twitter',
    tone: string,
    variantCount: number = 3
  ): Promise<string[]> {
    try {
      const platformSpecs = this.getPlatformSpecs(platform);
      const prompt = this.buildPrompt(documentContent, platform, tone, variantCount, platformSpecs);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const posts = this.parseGeneratedPosts(text, variantCount);
      return posts;
    } catch (error) {
      logger.error('Error generating content with Gemini:', error);
      throw new Error('Failed to generate content with AI');
    }
  }

  private getPlatformSpecs(platform: 'linkedin' | 'twitter') {
    const specs = {
      linkedin: {
        maxLength: 3000,
        style: 'professional and engaging',
        format: 'Use emojis sparingly, include 3-5 relevant hashtags at the end',
        audience: 'professionals and business leaders',
      },
      twitter: {
        maxLength: 280,
        style: 'concise and impactful',
        format: 'Use 1-2 emojis, include 2-3 hashtags naturally in the text',
        audience: 'broad social media users',
      },
    };
    return specs[platform];
  }

  private buildPrompt(
    documentContent: string,
    platform: string,
    tone: string,
    variantCount: number,
    platformSpecs: any
  ): string {
    return `You are an expert social media content creator. Your task is to create ${variantCount} unique ${platform} posts based on the following document content.

DOCUMENT CONTENT:
${documentContent.substring(0, 4000)}

REQUIREMENTS:
- Platform: ${platform.toUpperCase()}
- Tone: ${tone}
- Style: ${platformSpecs.style}
- Max Length: ${platformSpecs.maxLength} characters
- Format: ${platformSpecs.format}
- Target Audience: ${platformSpecs.audience}

INSTRUCTIONS:
1. Create ${variantCount} DISTINCT variations of posts
2. Each post should highlight different aspects or angles from the document
3. Make each post engaging, valuable, and action-oriented
4. Use appropriate hashtags relevant to the content
5. Include a call-to-action or thought-provoking question when appropriate
6. Ensure each post is self-contained and makes sense without the document

FORMAT YOUR RESPONSE:
Separate each post with "---POST---" on a new line.
Do not include any numbering, titles, or extra commentary.
Just provide the raw post content.

Example format:
[Post 1 content here]
---POST---
[Post 2 content here]
---POST---
[Post 3 content here]

Now generate the posts:`;
  }

  private parseGeneratedPosts(text: string, expectedCount: number): string[] {
    const posts = text
      .split('---POST---')
      .map(post => post.trim())
      .filter(post => post.length > 0);

    if (posts.length < expectedCount) {
      logger.warn(`Expected ${expectedCount} posts but got ${posts.length}`);
    }

    return posts.slice(0, expectedCount);
  }

  async generateWithRetry(
    documentContent: string,
    platform: 'linkedin' | 'twitter',
    tone: string,
    variantCount: number = 3,
    maxRetries: number = 2
  ): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const posts = await this.generateSocialMediaPost(
          documentContent,
          platform,
          tone,
          variantCount
        );

        if (posts.length >= variantCount) {
          return posts;
        }

        logger.warn(
          `Attempt ${attempt + 1}: Generated ${posts.length}/${variantCount} posts. Retrying...`
        );
      } catch (error) {
        lastError = error as Error;
        logger.error(`Attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to generate posts after multiple attempts');
  }
}

export default new GeminiService();
