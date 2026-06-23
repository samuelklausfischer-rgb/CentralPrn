export default function LoadingSpinner({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
