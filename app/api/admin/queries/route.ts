import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import SupportQuery from "@/models/SupportQuery"
import Institute from "@/models/Institute"

// GET /api/admin/queries - Get queries
export async function GET(req: Request) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isSuperAdmin = session.role === "super_admin" || (session.role === "admin" && !session.instituteId)
    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    if (isSuperAdmin) {
      const filter: any = {}
      if (status && status !== "all") {
        filter.status = status
      }

      const [queries, unreadCount, pendingCount] = await Promise.all([
        SupportQuery.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
        SupportQuery.countDocuments({ isReadByAdmin: false }),
        SupportQuery.countDocuments({ status: "pending" }),
      ])

      return NextResponse.json({
        success: true,
        queries,
        unreadCount,
        pendingCount,
      })
    }

    // Coaching institute: only their own queries
    if (!session.instituteId) {
      return NextResponse.json({ error: "No organization linked" }, { status: 403 })
    }

    const queries = await SupportQuery.find({ instituteId: session.instituteId })
      .sort({ createdAt: -1 })
      .lean()

    const unreadReplies = queries.filter((q) => q.isReadByInstitute === false && Boolean(q.adminReply)).length

    return NextResponse.json({
      success: true,
      queries,
      unreadReplies,
    })
  } catch (error: any) {
    console.error("GET /api/admin/queries error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch queries" }, { status: 500 })
  }
}

// POST /api/admin/queries - Submit a new query from an organization
export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let instituteId = session.instituteId
    let instituteName = session.instituteName || "Organization"
    let instituteCode = session.instituteCode || ""

    await connectDB()

    if (instituteId) {
      const inst = await Institute.findById(instituteId).select("name code email phone").lean()
      if (inst) {
        instituteName = inst.name || instituteName
        instituteCode = inst.code || instituteCode
      }
    } else if (session.role === "institute") {
      const inst = await Institute.findOne({ adminUserId: session.id }).select("name code email phone").lean()
      if (inst) {
        instituteId = inst._id.toString()
        instituteName = inst.name || instituteName
        instituteCode = inst.code || instituteCode
      }
    }

    if (!instituteId) {
      return NextResponse.json({ error: "Only organizations can submit support queries" }, { status: 403 })
    }

    const body = await req.json()
    const { subject, category, message, contactEmail, contactPhone } = body

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const email = (contactEmail || session.email || "").trim()
    const phone = (contactPhone || "").trim()

    const query = await SupportQuery.create({
      instituteId,
      instituteName,
      instituteCode,
      contactEmail: email,
      contactPhone: phone,
      submittedBy: session.id,
      submittedByName: session.name || "Institute Admin",
      subject: subject.trim(),
      category: category || "general",
      message: message.trim(),
      status: "pending",
      isReadByAdmin: false,
      isReadByInstitute: true,
    })

    const categoryLabels: Record<string, string> = {
      quota_increase: "Exam / Student Quota Increase",
      billing_fees: "Billing, License & Validity",
      feature_request: "Feature Request / Customization",
      technical_issue: "Technical Support / Bug",
      other: "General Query",
    }
    const catLabel = categoryLabels[category] || category || "General"

    // Construct standard mailto link to support@progrentures.com with the exact query
    const emailSubject = `REQUEST For Change - ${instituteName}${instituteCode ? ` (${instituteCode})` : ""} - ${subject.trim()}`
    const emailBody = `Hello Progrentures Support Team,

Please review the following change request submitted from the coaching institute portal:

--------------------------------------------------
INSTITUTE DETAILS:
--------------------------------------------------
Organization Name : ${instituteName}
Institute Code    : ${instituteCode || "N/A"}
Contact Email     : ${email}
Contact Phone     : ${phone || "N/A"}
Request Category  : ${catLabel}
Request Subject   : ${subject.trim()}

--------------------------------------------------
QUERY / REQUEST DETAILS:
--------------------------------------------------
${message.trim()}

--------------------------------------------------
Status: Logged into Admin Portal Desk
Submitted via: Progrentures Exam Platform`

    const mailtoUrl = `mailto:support@progrentures.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

    return NextResponse.json(
      {
        success: true,
        query,
        mailtoUrl,
        message: "Your query has been submitted. Platform administrators have been notified.",
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST /api/admin/queries error:", error)
    return NextResponse.json({ error: error.message || "Failed to submit query" }, { status: 500 })
  }
}

