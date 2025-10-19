import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../config/logger';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

interface ProcessingResult {
  content: string;
  metadata: {
    wordCount: number;
    characterCount: number;
    language?: string;
    title?: string;
    author?: string;
    extractedAt: string;
  };
  success: boolean;
  error?: string;
}

class DocumentProcessorService {
  async processFile(fileBuffer: Buffer, fileType: string): Promise<ProcessingResult> {
    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          return await this.processPDF(fileBuffer);
        case 'docx':
          return await this.processDOCX(fileBuffer);
        case 'txt':
          return this.processTXT(fileBuffer);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error: any) {
      logger.error(`Document processing error for ${fileType}:`, error);
      return {
        content: '',
        metadata: {
          wordCount: 0,
          characterCount: 0,
          extractedAt: new Date().toISOString(),
        },
        success: false,
        error: error.message,
      };
    }
  }

  async processURL(url: string): Promise<ProcessingResult> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentAI-Bot/1.0)',
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);

      $('script, style, nav, header, footer, aside').remove();

      const title = $('title').text().trim() ||
                   $('meta[property="og:title"]').attr('content') ||
                   $('h1').first().text().trim();

      const description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') ||
                         '';

      const articleContent = $('article').text() ||
                           $('main').text() ||
                           $('body').text();

      const content = this.cleanText(`${title}\n\n${description}\n\n${articleContent}`);

      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          characterCount: content.length,
          title,
          extractedAt: new Date().toISOString(),
        },
        success: true,
      };
    } catch (error: any) {
      logger.error('URL processing error:', error);
      return {
        content: '',
        metadata: {
          wordCount: 0,
          characterCount: 0,
          extractedAt: new Date().toISOString(),
        },
        success: false,
        error: error.message,
      };
    }
  }

  private async processPDF(fileBuffer: Buffer): Promise<ProcessingResult> {
    try {
      const data = await pdfParse(fileBuffer);

      const content = this.cleanText(data.text);

      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          characterCount: content.length,
          title: data.info?.Title,
          author: data.info?.Author,
          extractedAt: new Date().toISOString(),
        },
        success: true,
      };
    } catch (error: any) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private async processDOCX(fileBuffer: Buffer): Promise<ProcessingResult> {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const content = this.cleanText(result.value);

      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          characterCount: content.length,
          extractedAt: new Date().toISOString(),
        },
        success: true,
      };
    } catch (error: any) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  private processTXT(fileBuffer: Buffer): ProcessingResult {
    try {
      const content = this.cleanText(fileBuffer.toString('utf-8'));

      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          characterCount: content.length,
          extractedAt: new Date().toISOString(),
        },
        success: true,
      };
    } catch (error: any) {
      throw new Error(`TXT parsing failed: ${error.message}`);
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  async extractKeyInsights(content: string, maxInsights: number = 5): Promise<string[]> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

    const scoredSentences = sentences.map(sentence => {
      const score = this.scoreSentence(sentence);
      return { sentence: sentence.trim(), score };
    });

    scoredSentences.sort((a, b) => b.score - a.score);

    return scoredSentences.slice(0, maxInsights).map(s => s.sentence);
  }

  private scoreSentence(sentence: string): number {
    let score = 0;

    const importantWords = ['important', 'key', 'significant', 'critical', 'essential', 'major', 'primary'];
    importantWords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score += 2;
    });

    const actionWords = ['discover', 'learn', 'find', 'show', 'prove', 'demonstrate'];
    actionWords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score += 1.5;
    });

    if (sentence.match(/\d+%/)) score += 2;
    if (sentence.match(/\d+/)) score += 1;

    const words = sentence.split(/\s+/);
    if (words.length >= 10 && words.length <= 25) score += 1;

    return score;
  }

  async generateSummary(content: string, maxLength: number = 500): Promise<string> {
    if (content.length <= maxLength) {
      return content;
    }

    const insights = await this.extractKeyInsights(content, 3);
    let summary = insights.join('. ');

    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  validateDocument(content: string, minWordCount: number = 50): { valid: boolean; error?: string } {
    const wordCount = this.countWords(content);

    if (wordCount < minWordCount) {
      return {
        valid: false,
        error: `Document is too short. Minimum ${minWordCount} words required, but got ${wordCount}`,
      };
    }

    if (content.trim().length === 0) {
      return {
        valid: false,
        error: 'Document content is empty',
      };
    }

    return { valid: true };
  }
}

export default new DocumentProcessorService();
