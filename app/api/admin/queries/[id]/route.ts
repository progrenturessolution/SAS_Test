import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import SupportQuery from "@/models/SupportQuery"

// PATCH /api/admin/queries/[id] - Reply or mark as read
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing query ID" }, { status: 400 })
    }

    await connectDB()
    const query = await SupportQuery.findById(id)
    if (!query) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 })
    }

    const isSuperAdmin = session.role === "super_admin" || (session.role === "admin" && !session.instituteId)
    const body = await req.json()

    // 1. Sending a reply / follow-up message
    if (body.reply !== undefined) {
      const replyText = String(body.reply || "").trim()
      if (!replyText) {
        return NextResponse.json({ error: "Reply text cannot be empty" }, { status: 400 })
      }

      if (!query.replies) {
        query.replies = []
      }

      // If there was a legacy adminReply not in replies array, seed it first
      if (query.adminReply && query.replies.length === 0) {
        query.replies.push({
          senderRole: "admin",
          senderName: query.adminRepliedByName || "Platform Admin",
          message: query.adminReply,
          createdAt: query.adminRepliedAt || query.updatedAt || new Date(),
        })
      }

      if (isSuperAdmin) {
        const senderName = session.name || "Platform Admin"
        query.replies.push({
          senderRole: "admin",
          senderName,
          message: replyText,
          createdAt: new Date(),
        })

        query.adminReply = replyText
        query.adminRepliedAt = new Date()
        query.adminRepliedByName = senderName
        query.status = body.status === "resolved" ? "resolved" : "replied"
        query.isReadByAdmin = true
        query.isReadByInstitute = false // marks unread for institute
      } else if (session.instituteId && String(query.instituteId) === String(session.instituteId)) {
        // Institute sending a follow up message in this thread
        const senderName = session.name || query.instituteName || "Organization Admin"
        query.replies.push({
          senderRole: "institute",
          senderName,
          message: replyText,
          createdAt: new Date(),
        })
        query.status = "pending"
        query.isReadByAdmin = false // marks unread for super admin
        query.isReadByInstitute = true
      } else {
        return NextResponse.json({ error: "Unauthorized to reply to this query" }, { status: 403 })
      }

      await query.save()

      return NextResponse.json({
        success: true,
        query,
        message: "Message sent successfully",
      })
    }

    // 2. Mark as read
    if (body.markRead) {
      if (isSuperAdmin) {
        query.isReadByAdmin = true
      } else if (session.instituteId && String(query.instituteId) === String(session.instituteId)) {
        query.isReadByInstitute = true
      }
      await query.save()
      return NextResponse.json({ success: true, query })
    }

    // 3. Status change only (e.g. resolve)
    if (body.status && isSuperAdmin) {
      query.status = body.status
      if (body.status === "resolved") {
        query.isReadByAdmin = true
      }
      await query.save()
      return NextResponse.json({ success: true, query })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("PATCH /api/admin/queries/[id] error:", error)
    return NextResponse.json({ error: error.message || "Failed to process query action" }, { status: 500 })
  }
}
