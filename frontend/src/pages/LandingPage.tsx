import { Link } from "react-router-dom"
import {
  Brain,
  Activity,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Database,
  Cpu,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import { CyberGridPerspective } from "../components/CyberGridPerspective"

export function LandingPage() {

  // Real Cohort Cases data matching the Wope table layout
  const demoCases = [
    {
      id: "UCSF-PDGM-0018",
      age: 54,
      sex: "F",
      idh: "Mutant (0.98)",
      codeletion: "Codeleted (0.97)",
      grade: "Grade 4",
      verdict: "STABLE",
      verdictColor: "emerald",
      agreement: "100%",
      iqr: "0.08",
      matrix: "240×240×155",
    },
    {
      id: "UCSF-PDGM-0026",
      age: 62,
      sex: "M",
      idh: "Wildtype (0.02)",
      codeletion: "Intact (0.04)",
      grade: "Grade 4",
      verdict: "STABLE",
      verdictColor: "emerald",
      agreement: "96%",
      iqr: "0.11",
      matrix: "240×240×155",
    },
    {
      id: "UCSF-PDGM-0061",
      age: 41,
      sex: "M",
      idh: "Mutant (0.96)",
      codeletion: "Intact (0.09)",
      grade: "Grade 3",
      verdict: "STABLE",
      verdictColor: "emerald",
      agreement: "92%",
      iqr: "0.14",
      matrix: "240×240×155",
    },
    {
      id: "UCSF-PDGM-0073",
      age: 58,
      sex: "F",
      idh: "Borderline (0.54)",
      codeletion: "Intact (0.12)",
      grade: "Grade 4",
      verdict: "CONTESTED",
      verdictColor: "amber",
      agreement: "68%",
      iqr: "0.26",
      matrix: "240×240×155",
    },
    {
      id: "UCSF-PDGM-0232",
      age: 67,
      sex: "M",
      idh: "Wildtype (0.04)",
      codeletion: "Intact (0.02)",
      grade: "Grade 4",
      verdict: "STABLE",
      verdictColor: "emerald",
      agreement: "100%",
      iqr: "0.05",
      matrix: "240×240×155",
    },
    {
      id: "UCSF-PDGM-0243",
      age: 49,
      sex: "F",
      idh: "Mutant (0.91)",
      codeletion: "Codeleted (0.94)",
      grade: "Grade 2",
      verdict: "STABLE",
      verdictColor: "emerald",
      agreement: "94%",
      iqr: "0.12",
      matrix: "240×240×155",
    },
  ]

  return (
    <div className="relative min-h-screen w-full bg-[#05020a] text-white selection:bg-purple-500/30 selection:text-purple-200 overflow-x-hidden font-sans">
      
      {/* =========================================================================
          PERSPECTIVE GRID & INTENSE NEON HORIZON GLOW (Exact Wope aesthetic)
         ========================================================================= */}
      <CyberGridPerspective />

      {/* Intense Glowing Horizon Strip */}
      <div className="pointer-events-none absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-44 bg-gradient-to-t from-purple-500/25 via-fuchsia-600/35 to-transparent blur-[80px] z-0" />
      <div className="pointer-events-none absolute top-[57%] left-1/2 -translate-x-1/2 w-4/5 h-2 bg-gradient-to-r from-transparent via-purple-400/80 to-transparent blur-md z-0" />

      {/* Ambient Deep Radial Backlight */}
      <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-purple-900/20 blur-[160px] z-0" />

      {/* =========================================================================
          MINIMALIST TOP NAVBAR (Matching Wope: Logo Left, Center Links, Right Auth)
         ========================================================================= */}
      <header className="relative z-40 mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 md:px-12">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <Brain className="h-4 w-4" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-purple-300 transition-colors">
            void<span className="text-purple-400">pacs</span>
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-300">
          <a href="#hero" className="hover:text-white transition-colors">
            Overview
          </a>
          <a href="#dashboard" className="hover:text-white transition-colors">
            Case Engine
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Multiplicity AI
          </a>
          <a href="#specs" className="hover:text-white transition-colors">
            Specifications
          </a>
        </nav>

        {/* Right Auth / Action */}
        <div className="flex items-center gap-5 text-xs">
          <Link
            to="/login"
            className="text-slate-300 hover:text-white font-medium transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/cases"
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2 font-semibold text-white backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
          >
            Launch PACS
          </Link>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1 (100vh): HERO COPY & FLOATING INTERACTIVE DASHBOARD PREVIEW
         ========================================================================= */}
      <section
        id="hero"
        className="relative z-30 flex min-h-[calc(100vh-5rem)] w-full flex-col items-center justify-start px-4 sm:px-6 pt-12 pb-16 text-center"
      >
        {/* Main Headline (Exact Wope Typography styling) */}
        <h1 className="max-w-4xl text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.12]">
          New Era of Molecular <br className="hidden sm:inline" />
          Neuro-Oncology
        </h1>

        {/* Sub-headline */}
        <p className="mt-5 max-w-2xl text-sm sm:text-base text-slate-300/80 leading-relaxed font-normal">
          Let predictive multiplicity do the heavy lifting. Stratify IDH1/2 mutations, 1p/19q codeletion,
          and WHO CNS Grade directly from multiparametric MRI before biopsy.
        </p>

        {/* Center Pill Badge Button */}
        <div className="mt-6 inline-flex">
          <Link
            to="/cases"
            className="rounded-full border border-purple-500/40 bg-purple-950/40 px-5 py-2 text-xs font-medium text-purple-200 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:border-purple-400 hover:bg-purple-900/50 transition-all flex items-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>WHO 2021 CNS5 Taxonomy · 494 Verified Cases</span>
            <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
          </Link>
        </div>

        {/* =========================================================================
            THE GLASS DASHBOARD PREVIEW (Positioned on the horizon line like Wope)
           ========================================================================= */}
        <div
          id="dashboard"
          className="relative mt-12 w-full max-w-6xl rounded-2xl border border-white/15 bg-[#0e071c]/75 p-5 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.8),0_0_50px_rgba(168,85,247,0.15)] text-left transition-all"
        >
          {/* Dashboard Window Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-slate-300 font-semibold border border-white/10">
                <Brain className="h-3.5 w-3.5 text-purple-400" />
                <span>Virtual Biopsy Explorer</span>
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-purple-300 font-bold">UCSF-PDGM Test Split</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-slate-400">
                <Filter className="h-3 w-3" />
                <span>Filter</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-slate-400">
                <ArrowUpDown className="h-3 w-3" />
                <span>Sort: Agreement</span>
              </div>
              <Link
                to="/cases"
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1 font-bold text-white shadow transition-colors"
              >
                <span>Live Viewport</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Table Container (Styled identically to Wope Keyword Finder) */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Patient ID</th>
                  <th className="py-2.5 px-3">Clinical</th>
                  <th className="py-2.5 px-3">IDH Fused (AUC 0.977)</th>
                  <th className="py-2.5 px-3">1p/19q (AUC 0.974)</th>
                  <th className="py-2.5 px-3">WHO Grade</th>
                  <th className="py-2.5 px-3">Verdict</th>
                  <th className="py-2.5 px-3">Set Agreement</th>
                  <th className="py-2.5 px-3">Prob IQR</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {demoCases.map((c, idx) => (
                  <tr
                    key={idx}
                    className="group hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Patient ID */}
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                      <span>{c.id}</span>
                    </td>

                    {/* Age/Sex */}
                    <td className="py-3 px-3 text-slate-400">
                      {c.age}y · {c.sex}
                    </td>

                    {/* IDH */}
                    <td className="py-3 px-3 text-slate-200">
                      <span className="font-semibold text-purple-300">{c.idh}</span>
                    </td>

                    {/* 1p/19q */}
                    <td className="py-3 px-3 text-slate-300">
                      {c.codeletion}
                    </td>

                    {/* Grade */}
                    <td className="py-3 px-3 text-slate-300">
                      {c.grade}
                    </td>

                    {/* Verdict */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          c.verdict === "STABLE"
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                            : "bg-amber-950/80 text-amber-300 border border-amber-700/60"
                        }`}
                      >
                        {c.verdict === "STABLE" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Activity className="h-3 w-3" />
                        )}
                        <span>{c.verdict}</span>
                      </span>
                    </td>

                    {/* Agreement Bar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full"
                            style={{ width: c.agreement }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-300">{c.agreement}</span>
                      </div>
                    </td>

                    {/* IQR */}
                    <td className="py-3 px-3 text-slate-400">
                      ±{c.iqr}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/cases/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 px-2.5 py-1 text-[11px] font-semibold text-purple-200 transition-colors"
                      >
                        <span>Open 3D</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Status Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between border-t border-white/10 pt-3 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <span>Verified n=494 UCSF Patients</span>
              <span>·</span>
              <span className="text-emerald-400">● 15 Multiplicity Ensembles Deployed</span>
              <span>·</span>
              <span>240×240×155 True Voxel Arrays</span>
            </div>
            <Link
              to="/cases"
              className="text-purple-400 hover:text-purple-300 transition-colors font-bold flex items-center gap-1"
            >
              <span>Explore All 9 Test Demo Volumes</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

      </section>

      {/* =========================================================================
          SECTION 2 (100vh): RASHOMON MULTIPLICITY EXPLAINER
         ========================================================================= */}
      <section
        id="features"
        className="relative z-30 flex min-h-screen w-full flex-col items-center justify-center border-t border-white/10 bg-[#07030e] px-6 py-20 md:px-16"
      >
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-center space-y-8">
          <div className="flex flex-col space-y-3 text-center max-w-2xl mx-auto">
            <span className="font-mono text-xs font-bold text-purple-400 uppercase tracking-widest">
              The Rashomon Multiplicity Engine
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Why Single Models Fail In Neuro-Oncology
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              In clinical radiology, multiple distinct models achieve equal top-tier loss but make conflicting predictions on borderline patients. VOID isolates the entire near-optimal set to quantify true clinical certainty.
            </p>
          </div>

          {/* 3 Pillars of Multiplicity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 border border-purple-700/60 text-purple-400">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-white">24 Candidates Per Marker</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Trained across LightGBM, elastic-net Logistic Regression, and ExtraTrees with 50–70% feature bagging on 268 pyradiomics features.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 border border-purple-700/60 text-purple-400">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-base text-white">2.2% Error on Stable Calls</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When models achieve ≥85% consensus with probability IQR ≤ 0.20, test error drops to 2.2% (vs 42.9% on contested cases).
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 border border-purple-700/60 text-purple-400">
                <Cpu className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-base text-white">Low-Signal Safeguards</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Measures out-of-fold log-loss against base-rate prevalence. Markers that merely echo the prior (e.g. MGMT at 0.4% skill) flag "No reliable signal".
              </p>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-purple-900/30 to-purple-950/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-purple-400 shrink-0" />
              <span className="text-slate-200">
                <strong>Synergy Verified:</strong> 1p/19q test AUC increases from 0.897 to <strong>0.974</strong> when conditioned on known IDH mutation.
              </span>
            </div>
            <Link
              to="/cases"
              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2 font-bold text-white shadow transition-all shrink-0"
            >
              Test In Workspace →
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: FOOTER
         ========================================================================= */}
      <footer id="specs" className="relative z-30 border-t border-white/10 bg-[#040108] py-12 px-6 md:px-12 text-xs text-slate-500 font-mono">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="font-bold text-slate-300">VOID / PACS</span>
            <span>·</span>
            <span>UCSF-PDGM Molecular Multiplicity System</span>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-slate-400">
            <Link to="/cases" className="hover:text-purple-400 transition-colors">
              Patient Cohort
            </Link>
            <Link to="/login" className="hover:text-purple-400 transition-colors">
              Staff Portal
            </Link>
            <a
              href="https://github.com/Manipal-Hackathon-2026/Void"
              target="_blank"
              rel="noreferrer"
              className="hover:text-purple-400 transition-colors"
            >
              GitHub Repository
            </a>
          </div>

          <div className="text-[10px] text-slate-600">
            For Clinical Decision-Support & Investigational Research Use Only.
          </div>
        </div>
      </footer>

    </div>
  )
}
