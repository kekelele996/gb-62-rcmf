import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';
import {
  Visibility,
  getFollowingIds,
  buildFeedVisibilityFilter,
  buildProfileVisibilityFilter,
  canViewContent
} from '../utils/visibility';

type DiaryTag = 'SOWING' | 'GERMINATION' | 'FLOWERING' | 'HARVEST' | 'CARE' | 'OTHER';

const VISIBILITIES: Visibility[] = ['PUBLIC', 'FOLLOWERS'];

const parseVisibility = (value: unknown): Visibility =>
  VISIBILITIES.includes(value as Visibility) ? (value as Visibility) : 'PUBLIC';

export const createDiary = async (req: AuthRequest, res: Response) => {
  const { title, content, images, tags } = req.body;
  const visibility = parseVisibility(req.body.visibility);

  try {
    const diary = await prisma.diary.create({
      data: {
        title,
        content,
        images: images || [],
        tags: tags || [],
        visibility,
        authorId: req.userId!
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        }
      }
    });

    await addPoints(req.userId!, 20);

    res.status(201).json({ message: '日记发布成功', diary });
  } catch (error) {
    res.status(500).json({ error: '发布失败' });
  }
};

export const getDiaries = async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10, tag, userId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const viewerId = req.userId;

  try {
    const conditions: any[] = [];

    if (tag) {
      conditions.push({ tags: { has: tag as DiaryTag } });
    }

    if (userId) {
      // 个人主页：按作者 + 可见范围过滤
      const followingIds = await getFollowingIds(viewerId);
      conditions.push({
        authorId: userId as string,
        ...buildProfileVisibilityFilter(userId as string, viewerId, followingIds)
      });
    } else if (viewerId) {
      // 日记广场：公开日记 + 已关注花友的仅关注者日记 + 自己的日记
      const followingIds = await getFollowingIds(viewerId);
      conditions.push(buildFeedVisibilityFilter(viewerId, followingIds));
    } else {
      conditions.push({ visibility: { not: 'FOLLOWERS' } });
    }

    const where = conditions.length === 1 ? conditions[0] : { AND: conditions };

    const diaries = await prisma.diary.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        },
        _count: {
          select: { likes: true, comments: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.diary.count({ where });

    res.json({
      diaries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
};

export const getDiaryById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const viewerId = req.userId;

  try {
    const diary = await prisma.diary.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { likes: true }
        }
      }
    });

    if (!diary) {
      return res.status(404).json({ error: '日记不存在' });
    }

    const followingIds = await getFollowingIds(viewerId);
    if (!canViewContent(diary, viewerId, followingIds, req.isAdmin)) {
      return res.status(403).json({ error: '无权查看该日记' });
    }

    res.json(diary);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
};

export const updateDiary = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, content, images, tags, visibility } = req.body;

  try {
    const diary = await prisma.diary.findUnique({ where: { id } });

    if (!diary) {
      return res.status(404).json({ error: '日记不存在' });
    }

    if (diary.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权限修改' });
    }

    const updatedDiary = await prisma.diary.update({
      where: { id },
      data: {
        title: title || undefined,
        content: content || undefined,
        images: images || undefined,
        tags: tags || undefined,
        visibility: visibility ? parseVisibility(visibility) : undefined
      }
    });

    res.json({ message: '更新成功', diary: updatedDiary });
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
};

export const deleteDiary = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const diary = await prisma.diary.findUnique({ where: { id } });

    if (!diary) {
      return res.status(404).json({ error: '日记不存在' });
    }

    if (diary.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权限删除' });
    }

    await prisma.diary.delete({ where: { id } });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
};
