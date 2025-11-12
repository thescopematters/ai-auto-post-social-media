import { Router } from 'express';
import controller from '../controllers/imageGeneration.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/:workspaceId/generate-image', controller.generateImage.bind(controller));
router.delete('/:workspaceId/generated-images', controller.deleteGeneratedImage.bind(controller));

export default router;
