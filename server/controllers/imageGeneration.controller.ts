import { Request, Response } from 'express';
import Together from "together-ai";
import axios from 'axios';
import AWSS3Service from '../services/awsS3.service';
import logger from '../config/logger';
import dotenv from 'dotenv';
dotenv.config();

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
      if (!prompt?.trim()) {
        return res.status(400).json({ success: false, error: "Prompt is required" });
      }
      if (!workspaceId) {
        return res.status(400).json({ success: false, error: "Workspace ID is required" });
      }

      // Call Together AI
      const client = new Together({
        apiKey: process.env.TOGETHER_API_KEY,
      });
      console.log("TOGETHER_API_KEY", process.env.TOGETHER_API_KEY);
      const response = await client.images.generate({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: prompt.trim(),
      });

      const imageUrl = response.data[0].url;

      if (!imageUrl) {
        throw new Error("No image URL returned from Together AI");
      }

      // Download image from URL
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';

      // Prepare file for S3
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('webp')) ext = 'webp';

      const file: MediaFile = {
        buffer: imageBuffer,
        originalname: `ai-generated-${Date.now()}.${ext}`,
        mimetype: contentType,
        size: imageBuffer.length
      };

      if (file.size > 10 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: "Image too large (max 10MB)" });
      }

      // Upload to S3 AI bucket
      const s3Url = await AWSS3Service.uploadAIImage(file, workspaceId);
      console.log(">>>>>s3url", s3Url)
      return res.json({
        success: true,
        data: {
          imageUrl: s3Url,
          prompt: prompt.trim(),
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype
        },
        message: "Image generated and uploaded successfully"
      });

    } catch (error: any) {
      logger.error('❌ Image generation failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to generate image"
      });
    }
  }

  async deleteGeneratedImage(req: Request, res: Response) {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl || !imageUrl.includes('thescopematters-ai')) {
        return res.status(400).json({ success: false, error: "Invalid AI generated image URL" });
      }

      const deleted = await AWSS3Service.deleteFile(imageUrl);

      if (deleted) {
        return res.json({ success: true, message: "AI generated image deleted successfully" });
      } else {
        return res.status(500).json({ success: false, error: "Failed to delete AI generated image" });
      }

    } catch (error: any) {
      logger.error('❌ Failed to delete AI generated image:', error);
      return res.status(500).json({ success: false, error: "Failed to delete AI generated image" });
    }
  }
}

export default new ImageGenerationController();

