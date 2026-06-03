export default function ModuleIcon({ icon, size = 'md' }) {
  const sizes = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl' };
  return <span className={sizes[size]}>{icon}</span>;
}