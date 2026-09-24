import prisma from '../config/prisma';

export type Visibility = 'PUBLIC' | 'FOLLOWERS';

/**
 * 查询某花友已关注的用户ID集合
 */
export const getFollowingIds = async (userId?: string): Promise<string[]> => {
  if (!userId) return [];
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });
  return follows.map(f => f.followingId);
};

/**
 * 信息流可见范围过滤条件（不限作者）：
 * - 公开动态：所有登录花友可见
 * - 仅关注者动态：作者本人 + 已关注作者的花友可见
 *
 * 注意：visibility 不等于 FOLLOWERS 的写法同时兼容历史数据中
 * 缺失 visibility 字段的文档（MongoDB $ne 会命中无该字段的文档）。
 */
export const buildFeedVisibilityFilter = (
  viewerId: string,
  followingIds: string[]
) => ({
  OR: [
    { visibility: { not: 'FOLLOWERS' as Visibility } },
    { visibility: 'FOLLOWERS' as Visibility, authorId: viewerId },
    { visibility: 'FOLLOWERS' as Visibility, authorId: { in: followingIds } }
  ]
});

/**
 * 个人主页可见范围过滤条件（限定某个作者）：
 * - 作者本人：可见自己的全部内容
 * - 已关注作者的花友：公开 + 仅关注者
 * - 其他花友/游客：仅公开内容
 */
export const buildProfileVisibilityFilter = (
  authorId: string,
  viewerId?: string,
  followingIds: string[] = []
) => {
  if (viewerId === authorId) {
    return {};
  }
  if (followingIds.includes(authorId)) {
    return {};
  }
  return { visibility: { not: 'FOLLOWERS' as Visibility } };
};

/**
 * 判断当前花友是否可以查看某条内容
 */
export const canViewContent = (
  content: { authorId: string; visibility?: Visibility | null },
  viewerId: string | undefined,
  followingIds: string[],
  isAdmin = false
): boolean => {
  if (isAdmin) return true;
  if (content.visibility !== 'FOLLOWERS') return true;
  if (!viewerId) return false;
  return content.authorId === viewerId || followingIds.includes(content.authorId);
};
