import { useEffect, useRef } from 'react';
import * as lucide from 'lucide-react';

// Dynamic icon component using lucide-react
export default function Icon({ name, size = 18, className = "" }) {
  // Convert kebab-case to PascalCase for lucide-react
  const iconName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  const LucideIcon = lucide[iconName];
  
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }
  
  return <LucideIcon size={size} className={className} />;
}
