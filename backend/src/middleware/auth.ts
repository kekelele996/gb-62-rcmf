import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    req.userId = payload.userId;
    req.isAdmin = user.isAdmin;
    next();
  } catch (error) {
    res.status(500).json({ error: '认证失败' });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

/**
 * 可选认证：有合法令牌则解析登录用户，没有令牌也放行
 * （用于公开内容列表等游客可访问、登录后内容更多的接口）
 */
export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });
      if (user) {
        req.userId = payload.userId;
        req.isAdmin = user.isAdmin;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
