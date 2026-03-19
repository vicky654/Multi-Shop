export default function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 ${s} ${className}`} />
  );
}
