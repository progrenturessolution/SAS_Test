import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import GlobalSettings from "@/models/GlobalSettings"
import Institute from "@/models/Institute"

// GET /api/admin/settings
export async function GET(req: Request) {
  try {
    const session = await getSession(req)
    const canReadSettings = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canReadSettings) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    // 1. If logged in as Coaching Institute, return coaching profile & branding
    if (session.instituteId) {
      const institute = await Institute.findById(session.instituteId)
        .select("name code email phone address city contactPerson logo themeColor validUntil status limits")
        .lean()

      if (!institute) {
        return NextResponse.json({ error: "Institute not found" }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        isInstitute: true,
        institute: {
          id: institute._id.toString(),
          name: institute.name || "",
          code: institute.code || "",
          email: institute.email || "",
          phone: institute.phone || "",
          address: institute.address || "",
          city: institute.city || "",
          contactPerson: institute.contactPerson || "",
          logo: institute.logo || "",
          themeColor: institute.themeColor || "#2D3A4A",
          validUntil: institute.validUntil ? new Date(institute.validUntil).toISOString() : null,
          status: institute.status || "active",
          limits: institute.limits || null,
        },
      })
    }

    // 2. If logged in as Super Admin, return global platform settings
    let settings = await GlobalSettings.findOne().lean()
    if (!settings) {
      settings = await GlobalSettings.create({
        platformName: "Progrentures Exam Platform",
        supportEmail: "support@progrentures.com",
        supportPhone: "+91 93094 70958",
      })
    }

    return NextResponse.json({
      success: true,
      isSuperAdmin: true,
      settings,
    })
  } catch (err: any) {
    console.error("[GetAdminSettings] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/settings
export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const body = await req.json()

    // 1. Coaching Institute saves their profile, logo, and theme color
    if (session.instituteId) {
      const institute = await Institute.findById(session.instituteId)
      if (!institute) {
        return NextResponse.json({ error: "Institute not found" }, { status: 404 })
      }

      if (body.name !== undefined) institute.name = body.name.trim()
      if (body.phone !== undefined) institute.phone = body.phone.trim()
      if (body.address !== undefined) institute.address = body.address.trim()
      if (body.city !== undefined) institute.city = body.city.trim()
      if (body.contactPerson !== undefined) institute.contactPerson = body.contactPerson.trim()
      if (body.logo !== undefined) institute.logo = body.logo
      if (body.themeColor !== undefined) institute.themeColor = body.themeColor

      await institute.save()

      return NextResponse.json({
        success: true,
        isInstitute: true,
        institute: {
          id: institute._id.toString(),
          name: institute.name,
          code: institute.code,
          email: institute.email,
          phone: institute.phone || "",
          address: institute.address || "",
          city: institute.city || "",
          contactPerson: institute.contactPerson || "",
          logo: institute.logo || "",
          themeColor: institute.themeColor || "#2D3A4A",
        },
      })
    }

    // 2. Super Admin saves platform configuration
    if (!["super_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { platformName, supportEmail, supportPhone } = body
    let settings = await GlobalSettings.findOne()
    if (!settings) {
      settings = new GlobalSettings()
    }

    if (platformName !== undefined) settings.platformName = platformName
    if (supportEmail !== undefined) settings.supportEmail = supportEmail
    if (supportPhone !== undefined) settings.supportPhone = supportPhone

    await settings.save()

    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    console.error("[SaveAdminSettings] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
