import { body } from 'express-validator';

export const generateContentValidation = [
  body('documentId')
    .notEmpty()
    .withMessage('documentId is required')
    .isUUID()
    .withMessage('documentId must be a valid UUID'),

  body('platform')
    .notEmpty()
    .withMessage('platform is required')
    .isIn(['linkedin', 'twitter'])
    .withMessage('platform must be either "linkedin" or "twitter"'),

  body('tone')
    .notEmpty()
    .withMessage('tone is required')
    .isIn(['professional', 'casual', 'thought_leader', 'educational', 'promotional'])
    .withMessage('tone must be one of: professional, casual, thought_leader, educational, promotional'),

  body('variantCount')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('variantCount must be between 1 and 20'),

  body('agentConfigId')
    .optional()
    .isUUID()
    .withMessage('agentConfigId must be a valid UUID'),
];

export const updatePostValidation = [
  body('content')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('content must be between 1 and 5000 characters'),

  body('hashtags')
    .optional()
    .isArray()
    .withMessage('hashtags must be an array'),

  body('hashtags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('each hashtag must be between 1 and 50 characters'),

  body('mediaUrls')
    .optional()
    .isArray()
    .withMessage('mediaUrls must be an array'),

  body('mediaUrls.*')
    .optional()
    .isURL()
    .withMessage('each mediaUrl must be a valid URL'),
];

export const moderatePostValidation = [
  body('action')
    .notEmpty()
    .withMessage('action is required')
    .isIn(['approve', 'reject', 'flag'])
    .withMessage('action must be one of: approve, reject, flag'),

  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must not exceed 500 characters'),
];
