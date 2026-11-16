import { redirect } from "next/navigation"

export default async function ExamRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/exams/${id}/edit`)
}

