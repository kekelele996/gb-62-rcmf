import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';

// 公开动态的查询条件（旧数据没有 visibility 字段，按公开处理）
const PUBLIC_VISIBILITY_CONDITIONS = [
  { visibility: 'PUBLIC' },
  { visibility: null }
];

export const createMoment = async (req: AuthRequest, res: Response) => {
  const { content, images, visibility } = req.body;
  const momentVisibility = visibility === 'FOLLOWERS' ? 'FOLLOWERS' : 'PUBLIC';

  try {
    const moment = await prisma.moment.create({
      data: {
        content,
        images: images || [],
        visibility: momentVisibility,
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

export const getMoments = async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const userId = req.userId;

  try {
    const followings = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });

    const followingIds = followings.map(f => f.followingId);

    // 花友圈信息流：公开动态 + 自己关注的人的动态 + 自己的动态
    // 其中仅关注者可见的动态，只有作者本人或已关注作者的人能看到
    const where: any = {
      OR: [
        { OR: PUBLIC_VISIBILITY_CONDITIONS },
        { authorId: userId },
        ...(followingIds.length > 0
          ? [{ authorId: { in: followingIds }, visibility: 'FOLLOWERS' }]
          : [])
      ]
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
          select: { likes: true }
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

export const getUserMoments = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const viewerId = req.userId;

  try {
    // 仅作者本人或已关注作者的人可以看到"仅关注者"动态
    let canSeeFollowersOnly = viewerId === userId;
    if (!canSeeFollowersOnly && viewerId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: userId
          }
        }
      });
      canSeeFollowersOnly = !!follow;
    }

    const where: any = { authorId: userId };
    if (!canSeeFollowersOnly) {
      where.OR = PUBLIC_VISIBILITY_CONDITIONS;
    }

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
