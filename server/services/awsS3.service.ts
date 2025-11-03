import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

export interface MediaFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface S3Error extends Error {
  code?: string;
  statusCode?: number;
}

class AWSS3Service {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET_NAME || 'thescopematters';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async uploadFile(file: MediaFile, folderPath: string = 'posts'): Promise<string> {
    try {
      // Validate file first
      this.validateFile(file);

      const fileExtension = file.originalname
        .split('.')
        .pop()
        ?.toLowerCase() || 'bin';

      const fileName = `${folderPath}/${uuidv4()}.${fileExtension}`;

      const uploadParams = {
        Bucket: this.bucket,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read' as const,
        Metadata: {
          'uploaded-by': 'contentai',
          'upload-date': new Date().toISOString(),
        },
      };

      const command = new PutObjectCommand(uploadParams);
      const uploadResult = await this.s3Client.send(command);

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileName}`;

      logger.info(`✅ File uploaded successfully: ${url}`);
      return url;
    } catch (error: unknown) {
      const err = error as S3Error;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`❌ S3 upload error:`, {
        message: errorMessage,
        code: err.code,
        statusCode: err.statusCode,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      throw new Error(`File upload failed: ${errorMessage}`);
    }
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extract key from URL
      const key = this.extractKeyFromUrl(fileUrl);
      
      if (!key) {
        logger.warn(`⚠️ Could not extract key from URL: ${fileUrl}`);
        return false;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      logger.info(`✅ File deleted successfully: ${key}`);
      
      return true;
    } catch (error: unknown) {
      const err = error as S3Error;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`❌ S3 delete error:`, {
        message: errorMessage,
        code: err.code,
      });

      return false;
    }
  }

  private validateFile(file: MediaFile): void {
    // Check if file exists
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided');
    }

    // Check file size first (10MB max for better support)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(
        `File size exceeds 10MB limit. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      );
    }

    // Expanded allowed types to match your getFileType function
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      // PDFs
      'application/pdf',
      // Documents
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn(`⚠️ Rejected file type: ${file.mimetype} for file: ${file.originalname}`);
      throw new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: images, PDFs, and documents`
      );
    }

    logger.info(`✅ File validation passed: ${file.originalname} (${file.mimetype})`);
  }

  private extractKeyFromUrl(fileUrl: string): string | null {
    try {
      const urlParts = fileUrl.split(`${this.bucket}.s3.${this.region}.amazonaws.com/`);
      
      if (urlParts.length !== 2) {
        logger.warn(`⚠️ Unexpected URL format: ${fileUrl}`);
        return null;
      }

      return urlParts[1];
    } catch (error) {
      logger.error(`❌ Error extracting key from URL:`, error);
      return null;
    }
  }

  async getFileSize(fileUrl: string): Promise<number | null> {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) return null;

      // You can add HeadObjectCommand here if needed
      return null;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      return null;
    }
  }
}

export default new AWSS3Service();