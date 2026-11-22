"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Delete, Calculator, Move } from "lucide-react"

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
  const [mode, setMode] = useState<"basic" | "scientific">("scientific")

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
    if (typeof window !== "undefined" && isOpen) {
      const x = Math.max(20, Math.min(window.innerWidth - 370, window.innerWidth / 2 - 180))
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
      const newX = Math.max(10, Math.min(window.innerWidth - 350, dragRef.current.posX + dx))
      const newY = Math.max(10, Math.min(window.innerHeight - 350, dragRef.current.posY + dy))
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

  // Calculator actions
  const handleNumber = useCallback((n: string) => {
    setDisplay((prevDisplay) => {
      if (isNewNumber) {
        setIsNewNumber(false)
        return n === "." ? "0." : n
      } else {
        if (n === "." && prevDisplay.includes(".")) return prevDisplay
        return prevDisplay === "0" && n !== "." ? n : prevDisplay + n
      }
    })
  }, [isNewNumber])

  const handleClear = useCallback(() => {
    setDisplay("0")
    setExpression("")
    setIsNewNumber(true)
  }, [])

  const handleClearEntry = useCallback(() => {
    setDisplay("0")
    setIsNewNumber(true)
  }, [])

  const handleBackspace = useCallback(() => {
    if (isNewNumber) return
    setDisplay((prev) => {
      if (prev.length <= 1) {
        setIsNewNumber(true)
        return "0"
      }
      return prev.slice(0, -1)
    })
  }, [isNewNumber])

  const handleOperator = useCallback((op: string) => {
    const currentVal = parseFloat(display)
    if (isNaN(currentVal)) return
    setExpression(`${display} ${op} `)
    setIsNewNumber(true)
  }, [display])

  const handleToggleSign = useCallback(() => {
    const val = parseFloat(display)
    if (!isNaN(val)) {
      setDisplay((-val).toString())
    }
  }, [display])

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
  const handleScientific = useCallback((fn: string) => {
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

    const rounded = Number(res.toFixed(10))
    setDisplay(isNaN(rounded) ? "Error" : rounded.toString())
    setExpression(`${fn}(${val}) =`)
    setIsNewNumber(true)
  }, [display, isDegree])

  // Calculate binary expression
  const handleEquals = useCallback(() => {
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
  }, [expression, display])

  // Memory functions
  const handleMemory = useCallback((action: string) => {
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
  }, [display, memory])

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      if (e.key >= "0" && e.key <= "9") handleNumber(e.key)
      else if (e.key === ".") handleNumber(".")
      else if (e.key === "+") handleOperator("+")
      else if (e.key === "-") handleOperator("-")
      else if (e.key === "*") handleOperator("×")
      else if (e.key === "/") {
        e.preventDefault()
        handleOperator("÷")
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault()
        handleEquals()
      } else if (e.key === "Backspace") handleBackspace()
      else if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleNumber, handleOperator, handleEquals, handleBackspace, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-[330px] sm:w-[350px] bg-[#1E293B] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150 font-sans"
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[#0F172A] border-b border-slate-700/60 cursor-move"
      >
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-slate-300" />
          <span className="text-xs font-semibold text-slate-100 tracking-wide">
            Calculator
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Basic / Scientific Mode Segmented Toggle */}
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/70 text-[10px]">
            <button
              type="button"
              onClick={() => setMode("basic")}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                mode === "basic"
                  ? "bg-[#324158] text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Basic
            </button>
            <button
              type="button"
              onClick={() => setMode("scientific")}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                mode === "scientific"
                  ? "bg-[#324158] text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Scientific
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Calculator Display Screen */}
      <div className="px-3.5 py-2.5 bg-[#0B1120] border-b border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
          <div className="flex items-center gap-1.5">
            {mode === "scientific" && (
              <button
                type="button"
                onClick={() => setIsDegree(!isDegree)}
                className="px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-amber-400 font-bold text-[10px] cursor-pointer transition-colors"
                title="Click to toggle Deg/Rad"
              >
                {isDegree ? "DEG" : "RAD"}
              </button>
            )}
            {hasMemory && (
              <span className="px-1 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[9px] font-bold">
                M
              </span>
            )}
          </div>
          <span className="truncate max-w-[200px] text-right text-slate-400 text-xs">
            {expression || "\u00A0"}
          </span>
        </div>
        <div className="text-right text-2xl font-bold font-mono tracking-tight text-white overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="p-2.5 bg-[#1E293B] space-y-1.5 text-xs">
        {mode === "scientific" && (
          <>
            {/* Memory Buttons */}
            <div className="grid grid-cols-5 gap-1 text-[10px] font-medium text-slate-400 pb-0.5">
              {["MC", "MR", "MS", "M+", "M-"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMemory(m)}
                  className="py-1 bg-slate-800/70 hover:bg-slate-700 hover:text-white rounded-md transition-colors cursor-pointer active:scale-95"
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Scientific Keys Grid */}
            <div className="grid grid-cols-5 gap-1 text-[11px] font-medium text-slate-300">
              <button type="button" onClick={() => handleScientific("sin")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">sin</button>
              <button type="button" onClick={() => handleScientific("cos")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">cos</button>
              <button type="button" onClick={() => handleScientific("tan")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">tan</button>
              <button type="button" onClick={() => handleScientific("log")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">log</button>
              <button type="button" onClick={() => handleScientific("ln")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">ln</button>

              <button type="button" onClick={() => handleScientific("asin")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">sin⁻¹</button>
              <button type="button" onClick={() => handleScientific("acos")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">cos⁻¹</button>
              <button type="button" onClick={() => handleScientific("atan")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">tan⁻¹</button>
              <button type="button" onClick={() => handleScientific("pi")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer font-serif">π</button>
              <button type="button" onClick={() => handleScientific("e")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer font-serif">e</button>

              <button type="button" onClick={() => handleScientific("sqrt")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">√</button>
              <button type="button" onClick={() => handleScientific("sqr")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">x²</button>
              <button type="button" onClick={() => handleOperator("^")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">xʸ</button>
              <button type="button" onClick={() => handleScientific("fact")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">n!</button>
              <button type="button" onClick={() => handleScientific("recip")} className="py-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">1/x</button>
            </div>
          </>
        )}

        {/* Standard Keypad (Clean 4-column layout) */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="py-2.5 bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleClearEntry}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            CE
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-semibold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            title="Backspace"
          >
            <Delete size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleOperator("÷")}
            className="py-2.5 bg-[#324158] hover:bg-[#253244] active:bg-[#1a2330] text-blue-300 font-bold text-lg rounded-xl transition-colors cursor-pointer"
          >
            ÷
          </button>

          <button
            type="button"
            onClick={() => handleNumber("7")}
            className="py-2.5 bg-slate-850 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleNumber("8")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleNumber("9")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator("×")}
            className="py-2.5 bg-[#324158] hover:bg-[#253244] active:bg-[#1a2330] text-blue-300 font-bold text-lg rounded-xl transition-colors cursor-pointer"
          >
            ×
          </button>

          <button
            type="button"
            onClick={() => handleNumber("4")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleNumber("5")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleNumber("6")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator("-")}
            className="py-2.5 bg-[#324158] hover:bg-[#253244] active:bg-[#1a2330] text-blue-300 font-bold text-lg rounded-xl transition-colors cursor-pointer"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => handleNumber("1")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleNumber("2")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleNumber("3")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleOperator("+")}
            className="py-2.5 bg-[#324158] hover:bg-[#253244] active:bg-[#1a2330] text-blue-300 font-bold text-lg rounded-xl transition-colors cursor-pointer"
          >
            +
          </button>

          <button
            type="button"
            onClick={handleToggleSign}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
          >
            ±
          </button>
          <button
            type="button"
            onClick={() => handleNumber("0")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleNumber(".")}
            className="py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-lg rounded-xl transition-all shadow-md shadow-blue-900/40 cursor-pointer active:scale-95"
          >
            =
          </button>
        </div>
      </div>
    </div>
  )
}
