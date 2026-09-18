import { Skeleton } from "@/components/ui/skeleton"

// Exam Coding Page Skeleton
export function CodingPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-12 h-8 rounded" />
          <Skeleton className="w-20 h-8 rounded-full" />
          <Skeleton className="w-24 h-8 rounded-full" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Metadata */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-8" />
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-20 h-8 rounded-full" />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-12 rounded-lg" />
            <Skeleton className="flex-1 h-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Exam Taking Page Skeleton
export function ExamTakingSkeleton() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 flex-col p-4">
        <Skeleton className="h-6 w-full mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="w-full aspect-square rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-gray-200 p-4 bg-white">
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 bg-white flex gap-2">
          <Skeleton className="flex-1 h-10 rounded-lg" />
          <Skeleton className="flex-1 h-10 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Result Analytics Page Skeleton
export function ResultAnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>

      {/* Table */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// Admin List Page Skeleton
export function AdminListSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center gap-4 p-4 border-b border-gray-200">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-1/6 ml-auto" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/6 ml-auto" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="w-8 h-8 rounded" />
        ))}
      </div>
    </div>
  )
}

// Admin Detail Page Skeleton
export function AdminDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Result Lookup Page Skeleton
export function ResultLookupSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full rounded-lg mt-6" />
      </div>
    </div>
  )
}

// Generic Table Skeleton
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-200">
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          {[...Array(columns)].map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Generic Card Grid Skeleton
export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-lg" />
      ))}
    </div>
  )
}

// Page Header Skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-3">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

// Form Skeleton
export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  )
}

// Stats Grid Skeleton
export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ))}
    </div>
  )
}
