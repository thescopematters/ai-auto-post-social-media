import { Request, Response } from 'express';
import axios from 'axios';
import AWSS3Service from '../services/awsS3.service';
import logger from '../config/logger';

interface MediaFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export class ImageGenerationController {
  async generateImage(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { prompt } = req.body;

      // Validate input
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Prompt is required and must be a non-empty string"
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: "Workspace ID is required"
        });
      }

      let responseData: any;
      let contentType: string;

      try {
        // Step 1: Call n8n webhook
        const n8nResponse = await axios.post(
          "https://learnn8nwithritika.app.n8n.cloud/webhook/image-generation",
          { prompt: prompt.trim() },
          {
            timeout: 120000,
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json, image/*, */*'
            },
          }
        );

        responseData = n8nResponse.data;
        contentType = n8nResponse.headers['content-type'] || '';

      } catch (n8nError: any) {
        logger.error('❌ n8n API call failed:', {
          error: n8nError.message,
          status: n8nError.response?.status
        });

        return res.status(500).json({
          success: false,
          error: `Image generation service error: ${n8nError.message}`
        });
      }

      // Step 2: Handle different response formats
      let imageBuffer: Buffer;
      let finalContentType: string;

      // Case 1: Direct image binary data
      if (contentType.startsWith('image/')) {
        imageBuffer = Buffer.from(responseData);
        finalContentType = contentType;
      }
      // Case 2: JSON response with imageUrl
      else if (typeof responseData === 'object' && responseData.imageUrl) {
        try {
          // Download the image from the URL
          const imageResponse = await axios.get(responseData.imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
          });
          
          imageBuffer = Buffer.from(imageResponse.data);
          finalContentType = imageResponse.headers['content-type'] || 'image/jpeg';
        } catch (downloadError: any) {
          logger.error('❌ Failed to download image from URL:', downloadError.message);
          return res.status(500).json({
            success: false,
            error: `Failed to download generated image: ${downloadError.message}`
          });
        }
      }
      // Case 3: JSON response with base64 data
      else if (typeof responseData === 'object' && responseData.imageData) {
        try {
          const base64Data = responseData.imageData.replace(/^data:image\/\w+;base64,/, '');
          imageBuffer = Buffer.from(base64Data, 'base64');
          finalContentType = responseData.contentType || 'image/jpeg';
        } catch (base64Error: any) {
          logger.error('❌ Failed to decode base64 image:', base64Error.message);
          return res.status(500).json({
            success: false,
            error: `Failed to decode base64 image data: ${base64Error.message}`
          });
        }
      }
      // Case 4: Unknown format
      else {
        logger.error('❌ Unknown response format:', {
          contentType,
          dataType: typeof responseData,
          dataPreview: JSON.stringify(responseData).substring(0, 200)
        });
        return res.status(500).json({
          success: false,
          error: "Image generation service returned unknown response format"
        });
      }

      // Step 3: Validate we have image data
      if (!imageBuffer || imageBuffer.length === 0) {
        logger.error('❌ No image data after processing');
        return res.status(500).json({
          success: false,
          error: "Image generation service returned no image data"
        });
      }

      // Step 4: Prepare file for S3 upload to AI bucket
      let fileExtension = 'jpg';
      if (finalContentType.includes('png')) fileExtension = 'png';
      if (finalContentType.includes('gif')) fileExtension = 'gif';
      if (finalContentType.includes('webp')) fileExtension = 'webp';

      const file: MediaFile = {
        buffer: imageBuffer,
        originalname: `ai-generated-${Date.now()}.${fileExtension}`,
        mimetype: finalContentType,
        size: imageBuffer.length
      };

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          error: `Generated image is too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        });
      }

      // Step 5: Upload to AWS S3 AI Bucket using uploadAIImage method
      try {
        const s3Url = await AWSS3Service.uploadAIImage(file, workspaceId);

        // Step 6: Return success response with S3 URL
        return res.json({
          success: true,
          data: {
            imageUrl: s3Url,
            prompt: prompt.trim(),
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            bucket: process.env.AWS_S3_AI_BUCKET_NAME 
          },
          message: "Image generated and uploaded successfully to AI bucket"
        });

      } catch (s3Error: any) {
        logger.error('❌ S3 upload to AI bucket failed:', s3Error);
        return res.status(500).json({
          success: false,
          error: `Failed to upload image to AI storage: ${s3Error.message}`
        });
      }

    } catch (error: any) {
      logger.error('❌ Image generation failed:', {
        error: error.message,
        stack: error.stack,
        workspaceId: req.params.workspaceId,
        prompt: req.body.prompt?.substring(0, 100)
      });

      return res.status(500).json({
        success: false,
        error: error.message || "Failed to generate image"
      });
    }
  }

  async deleteGeneratedImage(req: Request, res: Response) {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: "Image URL is required"
        });
      }

      // Validate the URL is from the AI bucket
      if (!imageUrl.includes('thescopematters-ai')) {
        return res.status(400).json({
          success: false,
          error: "Invalid AI generated image URL"
        });
      }

      const deleted = await AWSS3Service.deleteFile(imageUrl);

      if (deleted) {
        return res.json({
          success: true,
          message: "AI generated image deleted successfully from AI bucket"
        });
      } else {
        return res.status(500).json({
          success: false,
          error: "Failed to delete AI generated image"
        });
      }

    } catch (error: any) {
      logger.error('❌ Failed to delete AI generated image:', error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete AI generated image"
      });
    }
  }
}

export default new ImageGenerationController();