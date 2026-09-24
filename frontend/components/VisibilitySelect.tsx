import { Globe, Users } from 'lucide-react';
import { Visibility } from '@/types';

interface Props {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

const options: { value: Visibility; label: string; desc: string; icon: typeof Globe }[] = [
  { value: 'PUBLIC', label: '公开', desc: '所有登录花友可见', icon: Globe },
  { value: 'FOLLOWERS', label: '仅关注者', desc: '只有关注你的花友可见', icon: Users }
];

// 发布内容时的可见范围选择器
export default function VisibilitySelect({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-start space-x-2 p-3 rounded-lg border text-left transition-colors ${
              active
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <Icon className={`w-5 h-5 mt-0.5 ${active ? 'text-green-600' : 'text-gray-400'}`} />
            <span>
              <span className={`block text-sm font-medium ${active ? 'text-green-700' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">{opt.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
