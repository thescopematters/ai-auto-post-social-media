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

export enum BucketType {
  USER_UPLOADS = 'user_uploads',
  AI_GENERATED = 'ai_generated'
}

class AWSS3Service {
  private s3Client: S3Client;
  private userBucket: string;
  private aiBucket: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.userBucket = process.env.AWS_S3_BUCKET_NAME || 'thescopematters';
    this.aiBucket = process.env.AWS_S3_AI_BUCKET_NAME || 'thescopematters-ai';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async uploadFile(
    file: MediaFile, 
    folderPath: string = 'posts',
    bucketType: BucketType = BucketType.USER_UPLOADS
  ): Promise<string> {
    try {
      // Validate file first
      this.validateFile(file, bucketType);

      const fileExtension = file.originalname
        .split('.')
        .pop()
        ?.toLowerCase() || 'bin';

      // Generate full file path
      const fileName = `${folderPath}/${uuidv4()}.${fileExtension}`;
      const bucket = bucketType === BucketType.AI_GENERATED ? this.aiBucket : this.userBucket;

      const uploadParams = {
        Bucket: bucket,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ACL: 'public-read' as const,
        Metadata: {
          'uploaded-by': bucketType === BucketType.AI_GENERATED ? 'ai-generator' : 'contentai',
          'upload-date': new Date().toISOString(),
          'bucket-type': bucketType,
        },
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const url = `https://${bucket}.s3.${this.region}.amazonaws.com/${fileName}`;

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
        bucketType,
      });

      throw new Error(`File upload failed: ${errorMessage}`);
    }
  }

  async uploadAIImage(
    file: MediaFile,
    workspaceId: string,
    folderName: string = 'ai-generated'
  ): Promise<string> {
    const folderPath = `workspaces/${workspaceId}/${folderName}`;
    return this.uploadFile(file, folderPath, BucketType.AI_GENERATED);
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Determine which bucket the file is in
      const bucketInfo = this.extractBucketAndKey(fileUrl);
      
      if (!bucketInfo) {
        logger.warn(`⚠️ Could not extract bucket/key from URL: ${fileUrl}`);
        return false;
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketInfo.bucket,
        Key: bucketInfo.key,
      });

      await this.s3Client.send(command);

      return true;
    } catch (error: unknown) {
      const err = error as S3Error;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`❌ S3 delete error:`, {
        message: errorMessage,
        code: err.code,
        url: fileUrl,
      });

      return false;
    }
  }

  private validateFile(file: MediaFile, bucketType: BucketType): void {
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

    // For AI-generated images, only allow image types
    if (bucketType === BucketType.AI_GENERATED) {
      const allowedAITypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];

      if (!allowedAITypes.includes(file.mimetype)) {
        logger.warn(`⚠️ Rejected AI image type: ${file.mimetype}`);
        throw new Error(
          `Invalid AI image type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP`
        );
      }
      return;
    }

    // Expanded allowed types for user uploads
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
  }

  private extractBucketAndKey(fileUrl: string): { bucket: string; key: string } | null {
    try {
      // Try AI bucket first
      let urlParts = fileUrl.split(`${this.aiBucket}.s3.${this.region}.amazonaws.com/`);
      
      if (urlParts.length === 2) {
        return {
          bucket: this.aiBucket,
          key: urlParts[1],
        };
      }

      // Try user bucket
      urlParts = fileUrl.split(`${this.userBucket}.s3.${this.region}.amazonaws.com/`);
      
      if (urlParts.length === 2) {
        return {
          bucket: this.userBucket,
          key: urlParts[1],
        };
      }

      logger.warn(`⚠️ Unexpected URL format: ${fileUrl}`);
      return null;
    } catch (error) {
      logger.error(`❌ Error extracting bucket/key from URL:`, error);
      return null;
    }
  }

  async getFileSize(fileUrl: string): Promise<number | null> {
    try {
      const bucketInfo = this.extractBucketAndKey(fileUrl);
      if (!bucketInfo) return null;

      // You can add HeadObjectCommand here if needed
      return null;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      return null;
    }
  }

  getBucketTypeFromUrl(fileUrl: string): BucketType | null {
    if (fileUrl.includes(this.aiBucket)) {
      return BucketType.AI_GENERATED;
    }
    if (fileUrl.includes(this.userBucket)) {
      return BucketType.USER_UPLOADS;
    }
    return null;
  }
}

export default new AWSS3Service();