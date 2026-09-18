"use client"

import Link from "next/link"
import Image from "next/image"
import { Clock, Camera } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import * as faceDetection from "@mediapipe/face_detection"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import "@tensorflow/tfjs"

// ─── Logo ────────────────────────────────────────────────────────────────────

export function ProcrentureLogo({ small, large }: { small?: boolean; large?: boolean }) {
  const w = large ? 180 : (small ? 60 : 120)
  const h = large ? 60 : (small ? 20 : 40)
  return (
    <div className="flex items-center">
      <Image
        src="/logo.png"
        alt="Progrentures Testro Lab"
        width={w}
        height={h}
        priority
        loading="eager"
        className="object-contain"
      />
    </div>
  )
}

// ─── Exam Header ──────────────────────────────────────────────────────────────

interface ExamHeaderProps {
  title: string
  section: string
  timeLeft: number
  duration: number
  studentName: string
  rollNo: string
  onSubmit: () => void
  warningCount?: number
  maxWarnings?: number
}

export function ExamHeader({
  title,
  section,
  timeLeft,
  duration,
  studentName,
  rollNo,
  onSubmit,
  warningCount = 0,
  maxWarnings = 3,
}: ExamHeaderProps) {
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0")
  const secs = (timeLeft % 60).toString().padStart(2, "0")
  
  // Dynamic color: Red if 75% time passed (25% remaining), otherwise Black as requested
  // Note: 75% passed means timeLeft <= 0.25 * duration
  const isUrgent = timeLeft <= (duration * 0.25)
  const timerColor = isUrgent ? "text-red-600" : "text-foreground"
  const timerBorder = isUrgent ? "border-red-500 bg-red-50 animate-pulse" : "border-gray-200 bg-white"
  const timerIconColor = isUrgent ? "text-red-600" : "text-primary"
  
  const initials = studentName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0 h-16 sm:h-20">
      {/* Left section: Logo and Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ProcrentureLogo />
        <div className="hidden sm:block h-8 border-l border-gray-200 mx-1" />
        <div className="hidden sm:block">
          <p className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">{title}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">{section}</p>
        </div>
      </div>

      {/* Center section: Timer Block */}
      <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1 sm:py-2 rounded-lg sm:rounded-xl border-2 transition-all duration-500 ${timerBorder} absolute left-1/2 -translate-x-1/2`}>
        <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${timerIconColor}`} />
        <div className="text-center">
          <p className="text-[7px] sm:text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-0.5">Time Left</p>
          <p className={`text-base sm:text-2xl font-black tabular-nums leading-none ${timerColor}`}>
            {mins}:{secs}
          </p>
        </div>
      </div>

      {/* Right section: Profile and Stats */}
      <div className="flex items-center gap-2 sm:gap-4">
        {warningCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-amber-700 font-semibold">Warnings: {warningCount}/{maxWarnings}</span>
          </div>
        )}
        <div className="text-right flex flex-col items-end">
          <p className="text-[11px] sm:text-sm font-bold text-foreground leading-tight hover:text-primary transition-colors cursor-default">{studentName}</p>
          <div className="flex items-center gap-1 text-[9px] sm:text-xs text-gray-400 font-medium">
            <span className="hidden sm:inline">Roll No:</span>
            <span>{rollNo}</span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm border border-gray-200 group relative">
          <span className="text-white text-[10px] sm:text-xs font-bold">{initials}</span>
          {/* Simple Mobile Warning indicator */}
          {warningCount > 0 && (
            <div className="sm:hidden absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center">
               <span className="text-[8px] text-white font-black">!</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Proctoring Camera (real getUserMedia + face detection) ───────────────────

interface ProctoringCameraProps {
  onFaceEvent?: (event: "no-face" | "multiple-faces" | "face-ok") => void
  onCameraStatusChange?: (status: "loading" | "active" | "denied" | "error") => void
}

export function ProctoringCamera({ onFaceEvent, onCameraStatusChange }: ProctoringCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<any>(null)
  const objectDetectorRef = useRef<any>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastFaceCountRef = useRef<number>(-1)
  const lastReportTimeRef = useRef<number>(0)
  const cameraReadyTimeRef = useRef<number>(0)
  const lastPhoneCheckRef = useRef<number>(0)
  const inFlightRef = useRef<boolean>(false)
  const onFaceEventRef = useRef<ProctoringCameraProps["onFaceEvent"]>(onFaceEvent)

  const [camStatus, setCamStatus] = useState<"loading" | "active" | "denied" | "error">("loading")
  const [faceStatus, setFaceStatus] = useState<"detecting" | "ok" | "none" | "multiple">("detecting")

  const REPORT_INTERVAL = 3000
  const GRACE_PERIOD = 2000
  const PHONE_CHECK_INTERVAL = 1500

  useEffect(() => {
    onFaceEventRef.current = onFaceEvent
  }, [onFaceEvent])

  useEffect(() => {
    onCameraStatusChange?.(camStatus)
  }, [camStatus, onCameraStatusChange])

  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        setCamStatus("loading")
        setFaceStatus("detecting")

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const detector = new (faceDetection as any).FaceDetection({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        })

        detector.setOptions({
          model: "short",
          minDetectionConfidence: 0.7,
        })

        detector.onResults((results: any) => {
          if (cancelled) return

          const image = results.image
          const detections = results.detections ?? []
          const faces = detections.length
          const now = Date.now()

          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

          if (faces > 0) {
            ctx.strokeStyle = faces > 1 ? "#FF0000" : "#00FF00"
            ctx.lineWidth = 3
            detections.forEach((detection: any) => {
              const b = detection.boundingBox
              const x = (b.xCenter - b.width / 2) * canvas.width
              const y = (b.yCenter - b.height / 2) * canvas.height
              const w = b.width * canvas.width
              const h = b.height * canvas.height
              ctx.strokeRect(x, y, w, h)
            })
          }

          if (lastFaceCountRef.current !== faces) {
            if (faces === 0) setFaceStatus("none")
            else setFaceStatus(faces > 1 ? "multiple" : "ok")
            lastFaceCountRef.current = faces
          }

          if (now - cameraReadyTimeRef.current >= GRACE_PERIOD && now - lastReportTimeRef.current >= REPORT_INTERVAL) {
            if (faces === 0) onFaceEventRef.current?.("no-face")
            else if (faces > 1) onFaceEventRef.current?.("multiple-faces")
            else onFaceEventRef.current?.("face-ok")
            lastReportTimeRef.current = now
          }
        })

        detectorRef.current = detector

        try {
          const cocoModel = await (cocoSsd as any).load()
          if (!cancelled) objectDetectorRef.current = cocoModel
        } catch (e) {
          // Optional phone detector failure should not block camera
        }

        let stream: MediaStream | null = null
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false,
          })
        } catch (err) {
          if (cancelled) return
          const e = err as { name?: string }
          setCamStatus(e?.name === "NotAllowedError" ? "denied" : "error")
          return
        }

        if (cancelled || !stream) {
          stream?.getTracks().forEach(track => track.stop())
          return
        }

        video.srcObject = stream
        video.muted = true
        video.playsInline = true

        await video.play().catch(() => {
          // Ignore autoplay errors; status will show denied/error if needed
        })

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        const resizeCanvas = () => {
          const w = video.videoWidth || 640
          const h = video.videoHeight || 480
          canvas.width = w
          canvas.height = h
        }

        if (video.readyState >= 2) resizeCanvas()
        else video.addEventListener("loadedmetadata", resizeCanvas, { once: true })

        setCamStatus("active")
        cameraReadyTimeRef.current = Date.now()

        const tick = async () => {
          if (cancelled) return

          const vw = video.videoWidth
          const vh = video.videoHeight

          if (vw > 0 && vh > 0) {
            if (canvas.width !== vw || canvas.height !== vh) {
              canvas.width = vw
              canvas.height = vh
            }
          }

          if (video.readyState >= 2 && vw > 0 && vh > 0 && detectorRef.current && !inFlightRef.current) {
            inFlightRef.current = true
            try {
              await (detectorRef.current as any).send({ image: video })
            } catch (e) {
              // Swallow detection errors to keep loop running
            } finally {
              inFlightRef.current = false
            }
          }

          const now = Date.now()
          if (objectDetectorRef.current && now - lastPhoneCheckRef.current >= PHONE_CHECK_INTERVAL && video.readyState >= 2 && vw > 0 && vh > 0) {
            lastPhoneCheckRef.current = now
            try {
              const predictions = await (objectDetectorRef.current as any).detect(video)
              predictions?.forEach((p: any) => {
                if (p.class === "cell phone" && p.score > 0.6) {
                  const ctx = canvas.getContext("2d")
                  if (!ctx) return
                  ctx.strokeStyle = "#FF0000"
                  ctx.lineWidth = 3
                  ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3])
                }
              })
            } catch (e) {
              // Ignore phone detection errors
            }
          }

          animationFrameRef.current = requestAnimationFrame(tick)
        }

        animationFrameRef.current = requestAnimationFrame(tick)
      } catch (err) {
        if (cancelled) return
        setCamStatus("error")
      }
    }

    setup()

    return () => {
      cancelled = true
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      const video = videoRef.current
      if (video?.srcObject) {
        ;(video.srcObject as MediaStream).getTracks().forEach(track => track.stop())
        video.srcObject = null
      }
    }
  }, [])

  const faceColor =
    faceStatus === "ok"
      ? "#10B981"
      : faceStatus === "multiple"
        ? "#F59E0B"
        : "#ef4444"

  const statusText =
    camStatus === "loading"
      ? "Starting camera..."
      : camStatus === "denied"
        ? "Camera access denied"
        : camStatus === "error"
          ? "Camera error"
          : faceStatus === "detecting"
            ? "Detecting face..."
            : faceStatus === "ok"
              ? "Camera Active - Face Detected"
              : faceStatus === "multiple"
                ? "Multiple Faces Detected!"
                : "Face Not Detected!"

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Proctoring Camera</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${camStatus === "active" ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
          <span className={`text-[10px] font-semibold ${camStatus === "active" ? "text-red-500" : "text-gray-400"}`}>
            {camStatus === "active" ? "REC" : "OFF"}
          </span>
        </div>
      </div>
      <div className="bg-[#0e1117] rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
        {/* Live video feed */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-0"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className={`absolute inset-0 w-full h-full object-cover rounded-xl ${camStatus === "active" ? "opacity-80" : "opacity-0"}`}
        />

        {/* Face detection overlay circle */}
        {camStatus === "active" && (
          <div
            className="relative z-10 w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors duration-500"
            style={{ borderColor: faceColor }}
          >
            <div
              className="w-10 h-10 rounded-full transition-colors duration-500"
              style={{ backgroundColor: faceStatus === "ok" ? "transparent" : "rgba(100,100,100,0.4)" }}
            />
          </div>
        )}

        {/* Status messages for non-active states */}
        {camStatus !== "active" && (
          <div className="flex flex-col items-center gap-2 z-10">
            <Camera className="w-8 h-8 text-gray-600" />
            <p className="text-[10px] text-gray-400 text-center px-3">{statusText}</p>
          </div>
        )}

        {/* Status label at bottom */}
        <p
          className="absolute bottom-2 left-0 right-0 text-center text-[9px] z-20 font-semibold transition-colors duration-300"
          style={{ color: camStatus === "active" ? faceColor : "#9ca3af" }}
        >
          {statusText}
        </p>

        {/* Multiple faces warning badge */}
        {faceStatus === "multiple" && (
          <div className="absolute top-2 left-0 right-0 flex justify-center z-20">
            <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              MULTIPLE FACES DETECTED
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section Tabs ─────────────────────────────────────────────────────────────

export type QuestionStatus = "answered" | "not-answered" | "review" | "not-visited"

export const statusColorMap: Record<QuestionStatus, string> = {
  answered: "bg-primary text-white",
  "not-answered": "bg-primary/15 text-primary",
  review: "bg-[#F59E0B] text-white",
  "not-visited": "bg-gray-100 text-gray-400",
}
