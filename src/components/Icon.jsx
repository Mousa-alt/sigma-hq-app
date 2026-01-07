import * as LucideIcons from 'lucide-react';

export default function Icon({ name, size = 16, className = '', style = {} }) {
  // Convert kebab-case to PascalCase for Lucide component lookup
  const iconName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const LucideIcon = LucideIcons[iconName];

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return <LucideIcon size={size} className={className} style={style} />;
}
