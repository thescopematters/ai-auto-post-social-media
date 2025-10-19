import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

interface UploadResult {
  bucket: string;
  key: string;
  location: string;
  etag: string;
}

class S3Service {
  private s3Client: AWS.S3 | null = null;
  private bucket: string = process.env.AWS_S3_BUCKET || 'contentai-uploads-sandbox';
  private region: string = process.env.AWS_S3_REGION || 'us-east-1';
  private isSandbox: boolean = process.env.AWS_SANDBOX_MODE === 'true';

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isSandbox) {
      logger.info('S3 Service running in SANDBOX mode - files will not be uploaded to real S3');
      return;
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      logger.warn('AWS credentials not found, S3 Service will run in sandbox mode');
      this.isSandbox = true;
      return;
    }

    this.s3Client = new AWS.S3({
      accessKeyId,
      secretAccessKey,
      region: this.region,
      signatureVersion: 'v4',
    });

    logger.info(`S3 Service initialized with bucket: ${this.bucket}, region: ${this.region}`);
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    workspaceId: string,
    contentType: string
  ): Promise<UploadResult> {
    if (this.isSandbox) {
      return this.mockUpload(fileName, workspaceId);
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const fileExtension = fileName.split('.').pop();
    const key = `${workspaceId}/${uuidv4()}.${fileExtension}`;

    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        workspace: workspaceId,
        originalName: fileName,
      },
    };

    try {
      const result = await this.s3Client.upload(params).promise();

      logger.info(`File uploaded successfully: ${key}`);

      return {
        bucket: this.bucket,
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  async uploadMultipart(
    file: Buffer,
    fileName: string,
    workspaceId: string,
    contentType: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    if (this.isSandbox) {
      return this.mockUpload(fileName, workspaceId);
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const fileExtension = fileName.split('.').pop();
    const key = `${workspaceId}/${uuidv4()}.${fileExtension}`;

    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    };

    try {
      const upload = this.s3Client.upload(params);

      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percentage);
        });
      }

      const result = await upload.promise();

      logger.info(`Multipart upload completed: ${key}`);

      return {
        bucket: this.bucket,
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
      };
    } catch (error) {
      logger.error('S3 multipart upload error:', error);
      throw new Error('Failed to complete multipart upload');
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.isSandbox) {
      return `https://sandbox-s3.contentai.local/${key}?expires=${Date.now() + expiresIn * 1000}`;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    };

    try {
      const url = await this.s3Client.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (this.isSandbox) {
      logger.info(`SANDBOX: Would delete file: ${key}`);
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.s3Client.deleteObject(params).promise();
      logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error('Failed to delete file from S3');
    }
  }

  async deleteMultipleFiles(keys: string[]): Promise<void> {
    if (this.isSandbox) {
      logger.info(`SANDBOX: Would delete ${keys.length} files`);
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    if (keys.length === 0) return;

    const params = {
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false,
      },
    };

    try {
      const result = await this.s3Client.deleteObjects(params).promise();
      logger.info(`Deleted ${result.Deleted?.length || 0} files from S3`);
    } catch (error) {
      logger.error('S3 batch delete error:', error);
      throw new Error('Failed to delete files from S3');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    if (this.isSandbox) {
      return true;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.s3Client.headObject(params).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  validateFile(fileName: string, fileSize: number, maxSize: number, allowedTypes: string[]): { valid: boolean; error?: string } {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (!fileExtension) {
      return { valid: false, error: 'Invalid file name' };
    }

    if (!allowedTypes.includes(fileExtension)) {
      return { valid: false, error: `File type .${fileExtension} is not allowed` };
    }

    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return { valid: false, error: `File size exceeds maximum of ${maxSizeMB}MB` };
    }

    return { valid: true };
  }

  private mockUpload(fileName: string, workspaceId: string): UploadResult {
    const key = `${workspaceId}/${uuidv4()}.${fileName.split('.').pop()}`;

    logger.info(`SANDBOX: Mock uploaded file: ${key}`);

    return {
      bucket: this.bucket,
      key,
      location: `https://sandbox-s3.contentai.local/${key}`,
      etag: `"${uuidv4()}"`,
    };
  }
}

export default new S3Service();
