import { Router } from 'express';
import {
  createMoment,
  getMoments,
  getUserMoments,
  getMomentById,
  deleteMoment
} from '../controllers/momentController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, createMoment);
router.get('/', authMiddleware, getMoments);
router.get('/user/:userId', optionalAuthMiddleware, getUserMoments);
router.get('/:id', optionalAuthMiddleware, getMomentById);
router.delete('/:id', authMiddleware, deleteMoment);

export default router;
