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

const VISIBILITIES: Visibility[] = ['PUBLIC', 'FOLLOWERS'];

const parseVisibility = (value: unknown): Visibility =>
  VISIBILITIES.includes(value as Visibility) ? (value as Visibility) : 'PUBLIC';

export const createMoment = async (req: AuthRequest, res: Response) => {
  const { content, images } = req.body;
  const visibility = parseVisibility(req.body.visibility);

  try {
    const moment = await prisma.moment.create({
      data: {
        content,
        images: images || [],
        visibility,
        authorId: req.userId!
      }
    });

    const momentWithAuthor = await prisma.moment.findUnique({
      where: { id: moment.id },
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

    await addPoints(req.userId!, 10);

    res.status(201).json({ message: '动态发布成功', moment: momentWithAuthor });
  } catch (error) {
    res.status(500).json({ error: '发布失败' });
  }
};

// 花友圈信息流：公开动态 + 已关注花友的仅关注者动态 + 自己的动态
export const getMoments = async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const userId = req.userId!;

  try {
    const followingIds = await getFollowingIds(userId);

    const where = {
      ...buildFeedVisibilityFilter(userId, followingIds)
    };

    const moments = await prisma.moment.findMany({
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
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
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

    const total = await prisma.moment.count({ where });

    res.json({
      moments,
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

// 个人主页动态：作者本人可见全部；粉丝可见公开+仅关注者；其他人仅可见公开
export const getUserMoments = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const viewerId = req.userId;

  try {
    const followingIds = await getFollowingIds(viewerId);

    const where = {
      authorId: userId,
      ...buildProfileVisibilityFilter(userId, viewerId, followingIds)
    };

    const moments = await prisma.moment.findMany({
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

    const total = await prisma.moment.count({ where });

    res.json({
      moments,
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

// 单条动态详情：按可见范围鉴权
export const getMomentById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const viewerId = req.userId;

  try {
    const moment = await prisma.moment.findUnique({
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
          select: { likes: true, comments: true }
        }
      }
    });

    if (!moment) {
      return res.status(404).json({ error: '动态不存在' });
    }

    const followingIds = await getFollowingIds(viewerId);
    if (!canViewContent(moment, viewerId, followingIds, req.isAdmin)) {
      return res.status(403).json({ error: '无权查看该动态' });
    }

    res.json(moment);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
};

export const deleteMoment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const moment = await prisma.moment.findUnique({ where: { id } });

    if (!moment) {
      return res.status(404).json({ error: '动态不存在' });
    }

    if (moment.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权限删除' });
    }

    await prisma.moment.delete({ where: { id } });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
};
