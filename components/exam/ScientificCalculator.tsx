"use client"

import { useState, useRef, useEffect } from "react"
import { X, Minus, RotateCcw, Move, Delete } from "lucide-react"

interface ScientificCalculatorProps {
  isOpen: boolean
  onClose: () => void
}

export function ScientificCalculator({ isOpen, onClose }: ScientificCalculatorProps) {
  const [display, setDisplay] = useState("0")
  const [expression, setExpression] = useState("")
  const [isDegree, setIsDegree] = useState(true)
  const [memory, setMemory] = useState<number>(0)
  const [hasMemory, setHasMemory] = useState(false)
  const [isNewNumber, setIsNewNumber] = useState(true)

  // Dragging state
  const [position, setPosition] = useState({ x: 80, y: 80 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 80,
    posY: 80,
  })

  useEffect(() => {
    // Center calculator on screen when first opened
    if (typeof window !== "undefined") {
      const x = Math.max(20, Math.min(window.innerWidth - 380, window.innerWidth / 2 - 180))
      const y = Math.max(60, Math.min(window.innerHeight - 520, 100))
      setPosition({ x, y })
    }
  }, [isOpen])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const newX = Math.max(10, Math.min(window.innerWidth - 360, dragRef.current.posX + dx))
      const newY = Math.max(10, Math.min(window.innerHeight - 400, dragRef.current.posY + dy))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

  if (!isOpen) return null

  // Calculator actions
  const handleNumber = (n: string) => {
    if (isNewNumber) {
      setDisplay(n === "." ? "0." : n)
      setIsNewNumber(false)
    } else {
      if (n === "." && display.includes(".")) return
      setDisplay(display === "0" && n !== "." ? n : display + n)
    }
  }

  const handleClear = () => {
    setDisplay("0")
    setExpression("")
    setIsNewNumber(true)
  }

  const handleClearEntry = () => {
    setDisplay("0")
    setIsNewNumber(true)
  }

  const handleBackspace = () => {
    if (isNewNumber) return
    if (display.length <= 1) {
      setDisplay("0")
      setIsNewNumber(true)
    } else {
      setDisplay(display.slice(0, -1))
    }
  }

  const handleOperator = (op: string) => {
    const currentVal = parseFloat(display)
    if (isNaN(currentVal)) return
    setExpression(`${display} ${op} `)
    setIsNewNumber(true)
  }

  const handleToggleSign = () => {
    const val = parseFloat(display)
    if (!isNaN(val)) {
      setDisplay((-val).toString())
    }
  }

  // Factorial helper
  const factorial = (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) return NaN
    if (n === 0 || n === 1) return 1
    if (n > 170) return Infinity
    let res = 1
    for (let i = 2; i <= n; i++) res *= i
    return res
  }

  // Scientific function handlers
  const handleScientific = (fn: string) => {
    const val = parseFloat(display)
    if (isNaN(val)) return

    let res = 0
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const toDeg = (rad: number) => (rad * 180) / Math.PI

    switch (fn) {
      case "sin":
        res = Math.sin(isDegree ? toRad(val) : val)
        break
      case "cos":
        res = Math.cos(isDegree ? toRad(val) : val)
        break
      case "tan":
        res = Math.tan(isDegree ? toRad(val) : val)
        break
      case "asin":
        res = isDegree ? toDeg(Math.asin(val)) : Math.asin(val)
        break
      case "acos":
        res = isDegree ? toDeg(Math.acos(val)) : Math.acos(val)
        break
      case "atan":
        res = isDegree ? toDeg(Math.atan(val)) : Math.atan(val)
        break
      case "sinh":
        res = Math.sinh(val)
        break
      case "cosh":
        res = Math.cosh(val)
        break
      case "tanh":
        res = Math.tanh(val)
        break
      case "ln":
        res = Math.log(val)
        break
      case "log":
        res = Math.log10(val)
        break
      case "exp":
        res = Math.exp(val)
        break
      case "10x":
        res = Math.pow(10, val)
        break
      case "sqrt":
        res = Math.sqrt(val)
        break
      case "cbrt":
        res = Math.cbrt(val)
        break
      case "sqr":
        res = val * val
        break
      case "cube":
        res = val * val * val
        break
      case "recip":
        res = 1 / val
        break
      case "abs":
        res = Math.abs(val)
        break
      case "fact":
        res = factorial(val)
        break
      case "pi":
        res = Math.PI
        break
      case "e":
        res = Math.E
        break
      default:
        return
    }

    // Round clean floats
    const rounded = Number(res.toFixed(10))
    setDisplay(isNaN(rounded) ? "Error" : rounded.toString())
    setExpression(`${fn}(${val}) =`)
    setIsNewNumber(true)
  }

  // Calculate binary expression
  const handleEquals = () => {
    if (!expression) return
    const parts = expression.trim().split(" ")
    if (parts.length < 2) return

    const prevVal = parseFloat(parts[0])
    const op = parts[1]
    const currentVal = parseFloat(display)
    if (isNaN(prevVal) || isNaN(currentVal)) return

    let result = 0
    switch (op) {
      case "+":
        result = prevVal + currentVal
        break
      case "-":
        result = prevVal - currentVal
        break
      case "×":
      case "*":
        result = prevVal * currentVal
        break
      case "÷":
      case "/":
        result = currentVal !== 0 ? prevVal / currentVal : NaN
        break
      case "%":
        result = prevVal % currentVal
        break
      case "^":
        result = Math.pow(prevVal, currentVal)
        break
      default:
        return
    }

    const rounded = Number(result.toFixed(10))
    setExpression(`${expression}${display} =`)
    setDisplay(isNaN(rounded) ? "Error" : rounded.toString())
    setIsNewNumber(true)
  }

  // Memory functions
  const handleMemory = (action: string) => {
    const val = parseFloat(display) || 0
    switch (action) {
      case "MC":
        setMemory(0)
        setHasMemory(false)
        break
      case "MR":
        setDisplay(memory.toString())
        setIsNewNumber(true)
        break
      case "MS":
        setMemory(val)
        setHasMemory(true)
        setIsNewNumber(true)
        break
      case "M+":
        setMemory((prev) => prev + val)
        setHasMemory(true)
        setIsNewNumber(true)
        break
      case "M-":
        setMemory((prev) => prev - val)
        setHasMemory(true)
        setIsNewNumber(true)
        break
    }
  }

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-[360px] sm:w-[380px] bg-[#1E293B] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150 font-sans"
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[#0F172A] border-b border-slate-700/60 cursor-move"
      >
        <div className="flex items-center gap-2">
          <Move size={14} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            NPTEL Scientific Calculator
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Calculator"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Calculator Display Screen */}
      <div className="p-3 bg-[#0B1120] border-b border-slate-800">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
          <div className="flex items-center gap-2">
            <span
              onClick={() => setIsDegree(!isDegree)}
              className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-bold text-[10px] cursor-pointer hover:bg-slate-700"
              title="Click to toggle Deg/Rad"
            >
              {isDegree ? "DEG" : "RAD"}
            </span>
            {hasMemory && <span className="text-[10px] font-bold text-emerald-400">M</span>}
          </div>
          <span className="truncate max-w-[220px] text-right">{expression || "\u00A0"}</span>
        </div>
        <div className="text-right text-2xl font-bold font-mono tracking-tight text-white overflow-x-auto whitespace-nowrap scrollbar-none py-1">
          {display}
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="p-2.5 bg-[#1E293B] space-y-1.5 text-xs">
        {/* Memory Row */}
        <div className="grid grid-cols-5 gap-1.5 text-[11px] font-semibold">
          {["MC", "MR", "MS", "M+", "M-"].map((m) => (
            <button
              key={m}
              onClick={() => handleMemory(m)}
              className="py-1.5 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              {m}
            </button>
          ))}
        </div>

        {/* Scientific Row 1 */}
        <div className="grid grid-cols-6 gap-1 text-[11px] font-medium">
          <button
            onClick={() => setIsDegree(!isDegree)}
            className="py-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 rounded-lg transition-colors font-bold"
          >
            {isDegree ? "Deg" : "Rad"}
          </button>
          <button
            onClick={() => handleScientific("sin")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            sin
          </button>
          <button
            onClick={() => handleScientific("cos")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            cos
          </button>
          <button
            onClick={() => handleScientific("tan")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            tan
          </button>
          <button
            onClick={() => handleScientific("ln")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            ln
          </button>
          <button
            onClick={() => handleScientific("log")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            log
          </button>
        </div>

        {/* Scientific Row 2 */}
        <div className="grid grid-cols-6 gap-1 text-[11px] font-medium">
          <button
            onClick={() => handleScientific("pi")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors font-serif"
          >
            π
          </button>
          <button
            onClick={() => handleScientific("asin")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            sin⁻¹
          </button>
          <button
            onClick={() => handleScientific("acos")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            cos⁻¹
          </button>
          <button
            onClick={() => handleScientific("atan")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            tan⁻¹
          </button>
          <button
            onClick={() => handleScientific("exp")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            eˣ
          </button>
          <button
            onClick={() => handleScientific("10x")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            10ˣ
          </button>
        </div>

        {/* Scientific Row 3 */}
        <div className="grid grid-cols-6 gap-1 text-[11px] font-medium">
          <button
            onClick={() => handleScientific("e")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors font-serif"
          >
            e
          </button>
          <button
            onClick={() => handleScientific("sinh")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            sinh
          </button>
          <button
            onClick={() => handleScientific("cosh")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            cosh
          </button>
          <button
            onClick={() => handleScientific("tanh")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            tanh
          </button>
          <button
            onClick={() => handleScientific("sqr")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            x²
          </button>
          <button
            onClick={() => handleScientific("cube")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            x³
          </button>
        </div>

        {/* Scientific Row 4 + Standard keypad */}
        <div className="grid grid-cols-6 gap-1 text-[11px] font-medium">
          <button
            onClick={() => handleScientific("fact")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            n!
          </button>
          <button
            onClick={() => handleScientific("sqrt")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            √
          </button>
          <button
            onClick={() => handleScientific("cbrt")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            ³√
          </button>
          <button
            onClick={() => handleOperator("^")}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors"
          >
            xʸ
          </button>
          <button
            onClick={handleClearEntry}
            className="py-1.5 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 font-bold rounded-lg transition-colors"
          >
            CE
          </button>
          <button
            onClick={handleClear}
            className="py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg transition-colors"
          >
            C
          </button>
        </div>

        {/* Main 5-row Keypad */}
        <div className="grid grid-cols-5 gap-1.5 pt-1 text-sm font-medium">
          {/* Row: 1/x, 7, 8, 9, ÷ */}
          <button
            onClick={() => handleScientific("recip")}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl text-xs font-medium"
          >
            1/x
          </button>
          <button
            onClick={() => handleNumber("7")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            7
          </button>
          <button
            onClick={() => handleNumber("8")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            8
          </button>
          <button
            onClick={() => handleNumber("9")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            9
          </button>
          <button
            onClick={() => handleOperator("÷")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-base rounded-xl"
          >
            ÷
          </button>

          {/* Row: |x|, 4, 5, 6, × */}
          <button
            onClick={() => handleScientific("abs")}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl text-xs font-medium"
          >
            |x|
          </button>
          <button
            onClick={() => handleNumber("4")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            4
          </button>
          <button
            onClick={() => handleNumber("5")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            5
          </button>
          <button
            onClick={() => handleNumber("6")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            6
          </button>
          <button
            onClick={() => handleOperator("×")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-base rounded-xl"
          >
            ×
          </button>

          {/* Row: %, 1, 2, 3, - */}
          <button
            onClick={() => handleOperator("%")}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl text-xs font-medium"
          >
            mod
          </button>
          <button
            onClick={() => handleNumber("1")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            1
          </button>
          <button
            onClick={() => handleNumber("2")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            2
          </button>
          <button
            onClick={() => handleNumber("3")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            3
          </button>
          <button
            onClick={() => handleOperator("-")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-base rounded-xl"
          >
            -
          </button>

          {/* Row: ±, 0, ., ⌫, + */}
          <button
            onClick={handleToggleSign}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl text-xs font-medium"
          >
            ±
          </button>
          <button
            onClick={() => handleNumber("0")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold"
          >
            0
          </button>
          <button
            onClick={() => handleNumber(".")}
            className="py-2 bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 rounded-xl font-bold text-base"
          >
            .
          </button>
          <button
            onClick={handleBackspace}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl flex items-center justify-center text-slate-300"
            title="Backspace"
          >
            <Delete size={16} />
          </button>
          <button
            onClick={() => handleOperator("+")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-base rounded-xl"
          >
            +
          </button>
        </div>

        {/* Equals Button Full Width */}
        <div className="pt-1">
          <button
            onClick={handleEquals}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
          >
            =
          </button>
        </div>
      </div>
    </div>
  )
}
