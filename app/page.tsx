"use client"

import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Clock,
  BarChart2,
  Shield,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-24">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="Progrentures Testro Lab"
              width={150}
              height={60}
              priority
              className="object-contain"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-primary transition-colors font-medium border-b-2 border-primary"
            >
              Home
            </Link>
            <Link
              href="https://progrentures.com/#contact"
              target="_blank"
              className="text-sm text-gray-600 hover:text-primary transition-colors font-medium"
            >
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-md hover:bg-accent transition-all shadow-sm"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-linear-to-br from-[#f0f4f8] to-[#e8f0f7] py-24">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600 font-medium mb-6">
              <span className="w-2 h-2 bg-[#45505F] rounded-full" />
              Trusted by Leading Organizations
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#1a2535] leading-tight mb-4 text-balance">
              Progrentures Testro Lab
            </h1>
            <p className="text-xl text-[#45505F] font-semibold mb-6 italic">
              Where Skills Are Truly Measured.
            </p>
            <p className="text-gray-500 text-base leading-relaxed mb-10 max-w-lg">
              Empower your evaluation process with our comprehensive assessment platform. From automated proctoring to detailed analytics, Progrentures Testro Lab provides the tools you need to conduct secure and efficient examinations.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => window.open('https://wa.me/919309470958', '_blank')}
                className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-accent transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                Schedule Demonstration
              </button>
              <button
                className="w-full sm:w-auto px-8 py-3.5 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Start Demo Video
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full" />
            <div className="relative bg-white rounded-3xl shadow-2xl p-2 md:p-4 overflow-hidden border border-gray-100">
              <div className="rounded-2xl overflow-hidden aspect-video relative bg-gray-100">
                <Image
                  src="/hero-illustration.jpg"
                  alt="Progrentures Testro Lab Platform"
                  width={600}
                  height={400}
                  className="object-cover w-full h-full"
                  priority
                />
                <div className="absolute inset-0 bg-black/5 flex items-center justify-center hover:bg-black/10 transition-all cursor-pointer group">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <div className="w-0 h-0 border-t-10 border-t-transparent border-l-18 border-l-primary border-b-10 border-b-transparent translate-x-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-3 text-balance">Why Choose Our Platform?</h2>
            <p className="text-gray-500">Everything you need to prepare, practice, and succeed in your examinations</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BookOpen, title: "Diverse Exam Library", desc: "Access thousands of practice questions across multiple subjects, difficulty levels, and exam patterns." },
              { icon: Clock, title: "Timed Assessments", desc: "Experience real exam conditions with timed tests, auto-submit, and section-wise time tracking." },
              { icon: BarChart2, title: "Detailed Analytics", desc: "Get comprehensive reports with performance insights, weak areas, and improvement suggestions." },
              { icon: Shield, title: "Secure Testing", desc: "Advanced proctoring, anti-cheating measures, and secure browser mode for fair assessments." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-gray-500">Get started in three simple steps</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-0.5 bg-gray-200" />
            {[
              { num: "1", title: "Create Account", desc: "Sign up with your email or phone number. Complete your profile with basic details." },
              { num: "2", title: "Choose Your Exam", desc: "Browse our library and select the exam you want to take. Filter by subject or difficulty." },
              { num: "3", title: "Take Test and Improve", desc: "Complete the exam, get instant results with detailed analytics, and track your progress." },
            ].map(({ num, title, desc }) => (
              <div key={num} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl mb-5 relative z-10">
                  {num}
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "10,000+", label: "Students Registered" },
            { value: "500+", label: "Practice Exams" },
            { value: "50,000+", label: "Questions Available" },
            { value: "95%", label: "Success Rate" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-4xl font-extrabold text-white mb-1">{value}</div>
              <div className="text-gray-400 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-[#324158] mb-3 text-balance">Ready to Start Your Exam Journey?</h2>
          <p className="text-gray-500 mb-8">Join thousands of students who are already improving their scores</p>
          <Link
            href="/admin"
            className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-md hover:bg-accent transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">2026 Progrentures Solution. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-gray-400 text-sm hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-gray-400 text-sm hover:text-white transition-colors">
              Terms of Service
            </Link>
            <button 
              onClick={() => window.open('https://wa.me/919309470958', '_blank')}
              className="text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
            >
              Contact Us
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
