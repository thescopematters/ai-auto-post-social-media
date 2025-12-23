// @ts-nocheck
import { Express } from 'express';
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

export const extractTextFromFile = async (file: Express.Multer.File): Promise<string> => {
    const mimeType = file.mimetype;
    console.log(`Extracting text from file: ${file.originalname}, type: ${mimeType}, size: ${file.size}`);

    try {
        if (mimeType === 'application/pdf') {
            const data = await pdf(file.buffer);
            return data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            return result.value;
        } else if (mimeType === 'text/plain') {
            return file.buffer.toString('utf-8');
        } else {
            throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
        }
    } catch (error) {
        console.error('Error extracting text:', error);
        throw new Error(`Failed to extract text from file: ${error.message}`);
    }
};
