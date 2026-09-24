import { Router } from 'express';
import {
  createDiary,
  getDiaries,
  getDiaryById,
  updateDiary,
  deleteDiary
} from '../controllers/diaryController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, createDiary);
router.get('/', optionalAuthMiddleware, getDiaries);
router.get('/:id', optionalAuthMiddleware, getDiaryById);
router.put('/:id', authMiddleware, updateDiary);
router.delete('/:id', authMiddleware, deleteDiary);

export default router;
