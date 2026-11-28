"use client"

import Image from "next/image"

/**
 * Standalone lightweight brand logo kept free of heavy proctoring/ML bundles
 * so exam login, result, and confirmation pages hydrate instantly.
 */
export function ProcrentureLogo({
  small,
  large,
  src,
  alt,
}: {
  small?: boolean
  large?: boolean
  src?: string | null
  alt?: string
}) {
  const w = large ? 180 : small ? 60 : 120
  const h = large ? 60 : small ? 20 : 40

  if (src) {
    return (
      <div className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || "Coaching Logo"}
          style={{ maxHeight: h, maxWidth: w }}
          className="object-contain"
        />
      </div>
    )
  }

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

