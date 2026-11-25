import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import GlobalSettings from "@/models/GlobalSettings"
import Institute from "@/models/Institute"
import User from "@/models/User"

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
        .select("name code email phone address city contactPerson logo themeColor validUntil status limits adminPassword")
        .lean()

      if (!institute) {
        return NextResponse.json({ error: "Institute not found" }, { status: 404 })
      }

      const canEditLogo = institute.limits?.features?.customLogo !== false
      const canEditThemeColor = institute.limits?.features?.customThemeColor !== false

      return NextResponse.json({
        success: true,
        isInstitute: true,
        permissions: {
          canEditLogo,
          canEditThemeColor,
        },
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
          adminPassword: institute.adminPassword || "",
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

      const canEditLogo = institute.limits?.features?.customLogo !== false
      const canEditThemeColor = institute.limits?.features?.customThemeColor !== false

      if (body.name !== undefined) institute.name = body.name.trim()
      if (body.phone !== undefined) institute.phone = body.phone.trim()
      if (body.address !== undefined) institute.address = body.address.trim()
      if (body.city !== undefined) institute.city = body.city.trim()
      if (body.contactPerson !== undefined) institute.contactPerson = body.contactPerson.trim()

      if (body.logo !== undefined && body.logo !== (institute.logo || "")) {
        if (!canEditLogo) {
          return NextResponse.json(
            { error: "Custom Logo editing is disabled for your organization. Contact administrator." },
            { status: 403 }
          )
        }
        institute.logo = body.logo
      }

      if (body.themeColor !== undefined && body.themeColor !== (institute.themeColor || "#2D3A4A")) {
        if (!canEditThemeColor) {
          return NextResponse.json(
            { error: "Theme Color customization is disabled for your organization. Contact administrator." },
            { status: 403 }
          )
        }
        institute.themeColor = body.themeColor
      }

      // Handle password update if provided
      if (body.newPassword && typeof body.newPassword === "string") {
        const trimmedPass = body.newPassword.trim()
        if (trimmedPass.length < 6) {
          return NextResponse.json({ error: "New password must be at least 6 characters long." }, { status: 400 })
        }
        institute.adminPassword = trimmedPass

        // Also update User account for this institute admin
        const user = await User.findOne({
          $or: [{ _id: institute.adminUserId }, { email: institute.email }],
        })
        if (user) {
          user.password = trimmedPass
          await user.save()
        }
      }

      await institute.save()

      return NextResponse.json({
        success: true,
        isInstitute: true,
        permissions: {
          canEditLogo,
          canEditThemeColor,
        },
        message: body.newPassword ? "Settings and password updated successfully!" : "Settings saved successfully!",
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
          adminPassword: institute.adminPassword || "",
          limits: institute.limits || null,
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
