import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import GlobalSettings from "@/models/GlobalSettings"

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
    let settings = await GlobalSettings.findOne().lean()
    if (!settings) {
      settings = await GlobalSettings.create({
        platformName: "Progrentures Exam Platform",
        supportEmail: "support@progrentures.com",
        supportPhone: "+91 93094 70958",
        proctoring: {
          faceDetection: true,
          tabSwitch: true,
          fullscreen: true,
          mobileFaceDetection: false,
          maxWarnings: 3,
        },
      })
    }

    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    console.error("[GetAdminSettings] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/settings
export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    if (!session || !["super_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const body = await req.json()
    const { platformName, supportEmail, supportPhone, proctoring } = body

    let settings = await GlobalSettings.findOne()
    if (!settings) {
      settings = new GlobalSettings()
    }

    if (platformName !== undefined) settings.platformName = platformName
    if (supportEmail !== undefined) settings.supportEmail = supportEmail
    if (supportPhone !== undefined) settings.supportPhone = supportPhone

    if (proctoring) {
      settings.proctoring = {
        faceDetection: typeof proctoring.faceDetection === "boolean" ? proctoring.faceDetection : settings.proctoring.faceDetection,
        tabSwitch: typeof proctoring.tabSwitch === "boolean" ? proctoring.tabSwitch : settings.proctoring.tabSwitch,
        fullscreen: typeof proctoring.fullscreen === "boolean" ? proctoring.fullscreen : settings.proctoring.fullscreen,
        mobileFaceDetection: typeof proctoring.mobileFaceDetection === "boolean" ? proctoring.mobileFaceDetection : settings.proctoring.mobileFaceDetection,
        maxWarnings: typeof proctoring.maxWarnings === "number" ? proctoring.maxWarnings : (Number(proctoring.maxWarnings) || settings.proctoring.maxWarnings),
      }
    }

    await settings.save()

    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    console.error("[SaveAdminSettings] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
