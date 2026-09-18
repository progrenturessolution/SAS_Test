/**
 * Seed script for Progrentures Online Exam Platform
 * Run: node scripts/seed.mjs
 *
 * Creates:
 * - 1 admin user (admin@progrentures.com / admin123)
 * - 2 sample exams with multiple sections including MCQ, True/False,
 *   Descriptive, Fill-in-Blanks, and Coding questions
 */

import bcrypt from "bcryptjs"
import mongoose from "mongoose"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

import dns from "dns"

try {
  dns.setDefaultResultOrder("ipv4first")
  dns.setServers(["8.8.8.8", "1.1.1.1"])
} catch {}

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: [join(__dirname, "../.env"), join(__dirname, "../.env.local")] })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("[seed] ERROR: MONGODB_URI not found in .env or .env.local")
  process.exit(1)
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["admin", "student"], default: "student" },
  createdAt: { type: Date, default: Date.now },
})

const QuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"] },
  questionText: String,
  options: [String],
  correctAnswer: String,
  explanation: String,
  marks: { type: Number, default: 1 },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  wordLimit: Number,
  blanks: [{ id: Number, label: String, answer: String }],
  codeTemplate: String,
  testCases: [{ input: String, expectedOutput: String, hidden: Boolean }],
  constraints: [String],
  timeLimit: Number,
  memoryLimit: Number,
})

const ExamSchema = new mongoose.Schema({
  title: String,
  subject: String,
  class: String,
  description: String,
  instructions: [String],
  duration: Number,
  totalMarks: Number,
  passMarks: Number,
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft" },
  sections: [
    {
      name: String,
      type: { type: String, enum: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"] },
      questionRange: String,
      questions: [QuestionSchema],
    },
  ],
  proctoring: {
    enabled: { type: Boolean, default: false },
    faceDetection: { type: Boolean, default: false },
    tabSwitch: { type: Boolean, default: true },
    fullscreenExit: { type: Boolean, default: true },
    maxWarnings: { type: Number, default: 3 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
})

const User = mongoose.models.User || mongoose.model("User", UserSchema)
const Exam = mongoose.models.Exam || mongoose.model("Exam", ExamSchema)

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("[seed] Connecting to MongoDB...")
  await mongoose.connect(MONGODB_URI)
  console.log("[seed] Connected.")

  // Clear existing seed data
  await User.deleteMany({ email: { $in: ["admin@progrentures.com", "demo@progrentures.com"] } })
  await Exam.deleteMany({ title: { $in: ["Class 10 Science Final Exam", "Computer Science Assessment - 2024"] } })

  // Admin user
  const adminPass = await bcrypt.hash("admin123", 12)
  const admin = await User.create({
    name: "Admin",
    email: "admin@progrentures.com",
    password: adminPass,
    role: "admin",
  })
  console.log("[seed] Created admin: admin@progrentures.com / admin123")

  // ─── Exam 1: Science ────────────────────────────────────────────────────
  const scienceExam = await Exam.create({
    title: "Class 10 Science Final Exam",
    subject: "Science",
    class: "Class 10",
    description: "Comprehensive final examination covering Physics, Chemistry, and Biology for Class 10 students.",
    instructions: [
      "Read each question carefully before answering. All questions are compulsory.",
      "Do not refresh or close the browser during the exam. Your progress is auto-saved.",
      "You can navigate between questions using the question palette on the right.",
      "Click 'Submit Exam' only when you have completed all questions.",
      "Proctoring is enabled. Keep your face visible to the camera at all times.",
    ],
    duration: 120,
    totalMarks: 100,
    passMarks: 40,
    status: "active",
    proctoring: {
      enabled: true,
      faceDetection: false,
      tabSwitch: true,
      fullscreenExit: true,
      maxWarnings: 3,
    },
    createdBy: admin._id,
    sections: [
      {
        name: "Section A - MCQ",
        type: "mcq",
        questionRange: "1-10",
        questions: [
          {
            type: "mcq",
            questionText: "Which of the following is the powerhouse of the cell?",
            options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
            correctAnswer: "B",
            explanation: "Mitochondria produces ATP through cellular respiration, making it the powerhouse of the cell.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "The process by which plants make their own food using sunlight is called:",
            options: ["Respiration", "Transpiration", "Photosynthesis", "Digestion"],
            correctAnswer: "C",
            explanation: "Photosynthesis is the process where plants use sunlight, CO2, and water to produce glucose.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "What is the chemical formula for water?",
            options: ["H2O2", "HO", "H2O", "H3O"],
            correctAnswer: "C",
            explanation: "Water consists of 2 hydrogen atoms and 1 oxygen atom, giving H2O.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "Which planet is known as the Red Planet?",
            options: ["Venus", "Jupiter", "Saturn", "Mars"],
            correctAnswer: "D",
            explanation: "Mars appears red due to iron oxide (rust) on its surface.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "Newton's second law of motion states that Force equals:",
            options: ["Mass × Velocity", "Mass × Acceleration", "Mass × Distance", "Mass × Time"],
            correctAnswer: "B",
            explanation: "F = ma, where F is force, m is mass, and a is acceleration.",
            marks: 2,
            difficulty: "medium",
          },
          {
            type: "mcq",
            questionText: "Which gas makes up about 78% of Earth's atmosphere?",
            options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
            correctAnswer: "C",
            explanation: "Nitrogen (N2) constitutes approximately 78% of Earth's atmosphere.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "The unit of electric current is:",
            options: ["Volt", "Watt", "Ohm", "Ampere"],
            correctAnswer: "D",
            explanation: "Electric current is measured in Amperes (A).",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "Which organ is responsible for pumping blood throughout the body?",
            options: ["Lungs", "Brain", "Heart", "Kidney"],
            correctAnswer: "C",
            explanation: "The heart pumps blood through the circulatory system.",
            marks: 2,
            difficulty: "easy",
          },
          {
            type: "mcq",
            questionText: "What is the speed of light in vacuum?",
            options: ["3 × 10^6 m/s", "3 × 10^8 m/s", "3 × 10^10 m/s", "3 × 10^4 m/s"],
            correctAnswer: "B",
            explanation: "The speed of light in vacuum is approximately 3 × 10^8 m/s.",
            marks: 2,
            difficulty: "medium",
          },
          {
            type: "mcq",
            questionText: "Which type of lens is used to correct myopia (nearsightedness)?",
            options: ["Convex lens", "Concave lens", "Bifocal lens", "Plain glass"],
            correctAnswer: "B",
            explanation: "Concave (diverging) lenses correct myopia by spreading light rays before they enter the eye.",
            marks: 2,
            difficulty: "medium",
          },
        ],
      },
      {
        name: "Section B - True/False",
        type: "truefalse",
        questionRange: "11-20",
        questions: [
          { type: "truefalse", questionText: "Sound can travel through a vacuum.", correctAnswer: "False", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "The sun is the closest star to Earth.", correctAnswer: "True", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "Humans and chimpanzees share approximately 98% of their DNA.", correctAnswer: "True", marks: 1, difficulty: "medium" },
          { type: "truefalse", questionText: "Diamonds are made of carbon atoms.", correctAnswer: "True", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "The boiling point of water at sea level is 100°C.", correctAnswer: "True", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "Electrons have a positive charge.", correctAnswer: "False", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "Photosynthesis releases carbon dioxide as a byproduct.", correctAnswer: "False", marks: 1, difficulty: "medium" },
          { type: "truefalse", questionText: "The human body has 206 bones in adulthood.", correctAnswer: "True", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "Acceleration due to gravity is approximately 9.8 m/s² on Earth.", correctAnswer: "True", marks: 1, difficulty: "medium" },
          { type: "truefalse", questionText: "Blood type is determined by the proteins on the surface of red blood cells.", correctAnswer: "True", marks: 1, difficulty: "medium" },
        ],
      },
      {
        name: "Section C - Descriptive",
        type: "descriptive",
        questionRange: "21-23",
        questions: [
          {
            type: "descriptive",
            questionText: "Explain the process of photosynthesis in detail. Describe the role of chlorophyll, light energy, carbon dioxide, and water in this process. Include the chemical equation and explain the significance of photosynthesis for life on Earth.",
            marks: 10,
            difficulty: "medium",
            wordLimit: 400,
          },
          {
            type: "descriptive",
            questionText: "Describe Newton's three laws of motion with examples from everyday life. How do these laws explain the movement of objects around us? Provide at least one real-world application for each law.",
            marks: 10,
            difficulty: "medium",
            wordLimit: 400,
          },
          {
            type: "descriptive",
            questionText: "What is the difference between renewable and non-renewable energy sources? Discuss the environmental impact of fossil fuels and explain why transitioning to renewable energy is important for sustainable development.",
            marks: 10,
            difficulty: "hard",
            wordLimit: 500,
          },
        ],
      },
      {
        name: "Section D - Fill in Blanks",
        type: "fillblanks",
        questionRange: "24-26",
        questions: [
          {
            type: "fillblanks",
            questionText: "The process of photosynthesis occurs primarily in the (1)________ of plant cells. During this process, plants convert (2)________ and water into glucose and oxygen. The green pigment responsible for capturing light energy is called (3)________.",
            marks: 3,
            blanks: [
              { id: 1, label: "Blank 1 - Location in plant cell (organelle)", answer: "chloroplasts" },
              { id: 2, label: "Blank 2 - Gas absorbed by plants", answer: "carbon dioxide" },
              { id: 3, label: "Blank 3 - Green pigment name", answer: "chlorophyll" },
            ],
          },
          {
            type: "fillblanks",
            questionText: "The powerhouse of the cell is the (1)________, which produces energy in the form of (2)________. This process is called cellular (3)________ and requires oxygen to function efficiently.",
            marks: 3,
            blanks: [
              { id: 1, label: "Blank 1 - Cell organelle", answer: "mitochondria" },
              { id: 2, label: "Blank 2 - Energy molecule (abbreviation)", answer: "ATP" },
              { id: 3, label: "Blank 3 - Process name", answer: "respiration" },
            ],
          },
          {
            type: "fillblanks",
            questionText: "In physics, Newton's second law states that Force = (1)________ × (2)________. The SI unit of force is the (3)________, named after the famous scientist.",
            marks: 3,
            blanks: [
              { id: 1, label: "Blank 1 - Physical quantity", answer: "mass" },
              { id: 2, label: "Blank 2 - Physical quantity", answer: "acceleration" },
              { id: 3, label: "Blank 3 - Unit of force", answer: "Newton" },
            ],
          },
        ],
      },
    ],
  })
  console.log(`[seed] Created exam: "${scienceExam.title}" (${scienceExam._id})`)

  // ─── Exam 2: Computer Science ────────────────────────────────────────────
  const csExam = await Exam.create({
    title: "Computer Science Assessment - 2024",
    subject: "Computer Science",
    class: "Class 12",
    description: "Comprehensive CS assessment covering programming fundamentals, data structures, algorithms, and coding challenges.",
    instructions: [
      "Read all questions carefully before answering.",
      "For coding questions, write clean and efficient code.",
      "You may use any programming language for coding problems.",
      "Time management is crucial - allocate time wisely across sections.",
      "All answers are final once the exam is submitted.",
    ],
    duration: 150,
    totalMarks: 120,
    passMarks: 50,
    status: "active",
    proctoring: {
      enabled: true,
      faceDetection: false,
      tabSwitch: true,
      fullscreenExit: true,
      maxWarnings: 3,
    },
    createdBy: admin._id,
    sections: [
      {
        name: "Section A - MCQ",
        type: "mcq",
        questionRange: "1-10",
        questions: [
          { type: "mcq", questionText: "What is the time complexity of binary search?", options: ["O(n)", "O(n²)", "O(log n)", "O(1)"], correctAnswer: "C", marks: 2, difficulty: "medium" },
          { type: "mcq", questionText: "Which data structure uses LIFO (Last In First Out)?", options: ["Queue", "Stack", "Array", "Linked List"], correctAnswer: "B", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "What does SQL stand for?", options: ["Structured Query Language", "Simple Query Language", "System Query Language", "Standard Query Language"], correctAnswer: "A", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "Which sorting algorithm has the best average-case time complexity?", options: ["Bubble Sort", "Selection Sort", "Quick Sort", "Insertion Sort"], correctAnswer: "C", marks: 2, difficulty: "medium" },
          { type: "mcq", questionText: "What does OOP stand for?", options: ["Object Oriented Programming", "Object Oriented Process", "Ordered Operations Program", "Open Object Protocol"], correctAnswer: "A", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "What is the output of: print(2 ** 3) in Python?", options: ["6", "9", "8", "5"], correctAnswer: "C", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "Which protocol is used for secure HTTP communication?", options: ["FTP", "HTTPS", "SMTP", "SSH"], correctAnswer: "B", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "What is a primary key in a relational database?", options: ["A key that can be null", "A key that uniquely identifies each record", "A key that references another table", "The first column of a table"], correctAnswer: "B", marks: 2, difficulty: "easy" },
          { type: "mcq", questionText: "Which of the following is NOT a valid Python data type?", options: ["list", "tuple", "array", "dictionary"], correctAnswer: "C", marks: 2, difficulty: "medium" },
          { type: "mcq", questionText: "What does the 'git commit' command do?", options: ["Uploads code to the remote repository", "Creates a snapshot of changes in the local repository", "Downloads the latest changes", "Creates a new branch"], correctAnswer: "B", marks: 2, difficulty: "easy" },
        ],
      },
      {
        name: "Section B - True/False",
        type: "truefalse",
        questionRange: "11-15",
        questions: [
          { type: "truefalse", questionText: "An array in most programming languages has a fixed size once created.", correctAnswer: "True", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "In Python, lists are immutable.", correctAnswer: "False", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "The Big-O notation describes the worst-case performance of an algorithm.", correctAnswer: "True", marks: 1, difficulty: "medium" },
          { type: "truefalse", questionText: "HTML is a programming language.", correctAnswer: "False", marks: 1, difficulty: "easy" },
          { type: "truefalse", questionText: "A linked list allows O(1) access by index.", correctAnswer: "False", marks: 1, difficulty: "medium" },
        ],
      },
      {
        name: "Section C - Descriptive",
        type: "descriptive",
        questionRange: "16-17",
        questions: [
          {
            type: "descriptive",
            questionText: "Explain the concept of recursion in programming. Provide an example of a recursive function and explain how the call stack works during recursion. What are the advantages and disadvantages of recursion compared to iteration?",
            marks: 15,
            difficulty: "medium",
            wordLimit: 400,
          },
          {
            type: "descriptive",
            questionText: "What are the SOLID principles in object-oriented programming? Explain each principle with an example and describe how following these principles leads to better software design.",
            marks: 15,
            difficulty: "hard",
            wordLimit: 500,
          },
        ],
      },
      {
        name: "Section D - Coding",
        type: "coding",
        questionRange: "18-20",
        questions: [
          {
            type: "coding",
            questionText: "Two Sum",
            marks: 20,
            difficulty: "easy",
            codeTemplate: "class Solution:\n    def twoSum(self, nums, target):\n        # Write your solution here\n        pass",
            testCases: [
              { input: "nums = [2, 7, 11, 15], target = 9", expectedOutput: "[0, 1]" },
              { input: "nums = [3, 2, 4], target = 6", expectedOutput: "[1, 2]" },
              { input: "nums = [3, 3], target = 6", expectedOutput: "[0, 1]" },
            ],
            constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
            timeLimit: 2,
            memoryLimit: 256,
          },
          {
            type: "coding",
            questionText: "Reverse a String",
            marks: 10,
            difficulty: "easy",
            codeTemplate: "def reverseString(s):\n    # Write your solution here\n    pass",
            testCases: [
              { input: 'hello', expectedOutput: 'olleh' },
              { input: 'world', expectedOutput: 'dlrow' },
            ],
            constraints: ["1 <= s.length <= 10^5"],
            timeLimit: 1,
            memoryLimit: 128,
          },
          {
            type: "coding",
            questionText: "Find the maximum element in an array without using built-in max function.",
            marks: 10,
            difficulty: "easy",
            codeTemplate: "def findMax(arr):\n    # Write your solution here\n    pass",
            testCases: [
              { input: "[3, 1, 4, 1, 5, 9, 2, 6]", expectedOutput: "9" },
              { input: "[-1, -5, -3]", expectedOutput: "-1" },
            ],
            constraints: ["1 <= arr.length <= 10^5"],
            timeLimit: 1,
            memoryLimit: 128,
          },
        ],
      },
    ],
  })
  console.log(`[seed] Created exam: "${csExam.title}" (${csExam._id})`)
  console.log("  Admin login:  admin@progrentures.com  /  admin123")
  console.log(`  Exam 1 URL: /exam/${scienceExam._id}`)
  console.log(`  Exam 2 URL: /exam/${csExam._id}`)
  console.log("\n  Visit /admin to log in and manage exams.")

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error("[seed] Fatal error:", err)
  process.exit(1)
})
