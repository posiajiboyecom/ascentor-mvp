// components/learn/CategoryIcon.tsx
// Icon for a course category (one of the six dimensions of a total person).
// Replaces the old emoji lookup; unknown categories get a generic book icon.

import { Brain, Briefcase, Landmark, Handshake, Globe, Trophy, BookOpen, type LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Mind: Brain,
  Vocation: Briefcase,
  Character: Landmark,
  Relationships: Handshake,
  Community: Globe,
  Legacy: Trophy,
};

export function CategoryIcon({
  category,
  size = 18,
  className,
}: {
  category: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = (category && CATEGORY_ICONS[category]) || BookOpen;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
