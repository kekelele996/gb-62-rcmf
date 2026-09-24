import { Globe, Users } from 'lucide-react';
import { Visibility } from '@/types';

interface Props {
  visibility: Visibility;
  className?: string;
}

// 可见范围徽标：公开 / 仅关注者
export default function VisibilityBadge({ visibility, className = '' }: Props) {
  if (visibility === 'FOLLOWERS') {
    return (
      <span
        className={`inline-flex items-center space-x-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ${className}`}
        title="仅作者的关注者可见"
      >
        <Users className="w-3 h-3" />
        <span>仅关注者</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center space-x-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ${className}`}
      title="所有登录花友可见"
    >
      <Globe className="w-3 h-3" />
      <span>公开</span>
    </span>
  );
}
