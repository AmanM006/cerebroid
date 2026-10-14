import { Link } from "react-router-dom"
import {
  Activity,
  Layers,
  Dna,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Database,
  Cpu,
  Brain,
  FileCheck2,
  Lock,
  GitBranch,
  Sparkles,
} from "lucide-react"
import { ParticlesBackground } from "../components/reactbits/ParticlesBackground"
import { SpotlightCard } from "../components/reactbits/SpotlightCard"
import { DecryptedText } from "../components/reactbits/DecryptedText"
import { ShinyText } from "../components/reactbits/ShinyText"

export function LandingPage() {
  return (
    <div className="relative min-h-screen w-full bg-[#030303] text-white selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* =========================================================================
          GLOBAL STICKY NAVBAR (Ultra-Clean Glassmorphism)
         ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-between border-b border-neutral-850/80 bg-[#050505]/75 px-6 backdrop-blur-xl md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-950/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold tracking-widest text-white uppercase">
              VOID <span className="text-cyan-400">/</span> PACS
            </span>
            <span className="text-[10px] font-mono text-neutral-400 tracking-tight">
              Virtual Molecular Biopsy
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-8 md:flex font-mono text-xs text-neutral-400">
          <a href="#hero" className="hover:text-white transition-colors">
            Overview
          </a>
          <a href="#multiplicity" className="hover:text-white transition-colors">
            Multiplicity Engine
          </a>
          <a href="#neuroimaging" className="hover:text-white transition-colors">
            3D NIfTI GPU
          </a>
          <a href="#biomarkers" className="hover:text-white transition-colors">
            WHO 2021 CNS5
          </a>
          <a href="#architecture" className="hover:text-white transition-colors">
            Architecture
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-xl border border-neutral-800 bg-[#101010] px-4 py-1.5 font-mono text-xs text-neutral-300 hover:border-neutral-600 hover:text-white transition-all"
          >
            Sign In
          </Link>
          <Link
            to="/cases"
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950 via-cyan-900 to-cyan-950 px-4 py-1.5 font-mono text-xs font-bold text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:border-cyan-400 hover:text-white transition-all"
          >
            <span>Launch PACS</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1 (100vh): HERO - Autonomous Virtual Molecular Biopsy
         ========================================================================= */}
      <section
        id="hero"
        className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center"
      >
        <ParticlesBackground quantity={75} color="#22d3ee" staticity={30} />

        {/* Ambient Radial Spotlight */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-cyan-600/10 blur-[140px]" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center space-y-6">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-mono text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <DecryptedText
              text="WHO 2021 CNS5 GOLD STANDARD · RASHOMON MULTIPLICITY ENGINE"
              speed={30}
              encryptedClassName="text-cyan-400 font-mono"
            />
          </div>

          {/* Main Title */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
            <span className="block text-neutral-100">Virtual Molecular</span>
            <span className="mt-1 block">
              <ShinyText
                text="Neuro-Oncology Biopsy"
                className="font-extrabold tracking-tight"
                speed={4}
              />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl text-base text-neutral-400 md:text-lg leading-relaxed">
            Non-invasive pre-operative classification of{" "}
            <span className="text-neutral-200 font-semibold">IDH1/2</span>,{" "}
            <span className="text-neutral-200 font-semibold">1p/19q codeletion</span>,{" "}
            <span className="text-neutral-200 font-semibold">MGMT promoter methylation</span>, and{" "}
            <span className="text-neutral-200 font-semibold">WHO CNS Grade</span> directly from
            multiparametric MRI before scalpel incision.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/cases"
              className="flex items-center gap-2 rounded-xl border border-cyan-400 bg-cyan-500 px-6 py-3 font-mono text-sm font-bold text-black shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:bg-cyan-400 hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all"
            >
              <Activity className="h-4 w-4" />
              <span>Explore Patient Cohort</span>
            </Link>
            <Link
              to="/cases/UCSF-PDGM-0018"
              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#121212] px-6 py-3 font-mono text-sm text-neutral-300 hover:border-neutral-600 hover:text-white transition-all"
            >
              <Brain className="h-4 w-4 text-cyan-400" />
              <span>Launch Demo Case (0018)</span>
            </Link>
          </div>

          {/* Real Metrics Ticker */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 w-full max-w-3xl">
            {[
              { label: "IDH Fused AUC", val: "0.9772", sub: "[0.941–0.999]" },
              { label: "1p/19q Given IDH", val: "0.9744", sub: "Synergy Peak" },
              { label: "GRADE Fused AUC", val: "0.9988", sub: "True 3D Spatial" },
              { label: "Cohort Validated", val: "n=494", sub: "UCSF-PDGM Test" },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded-xl border border-neutral-850 bg-[#080808]/80 p-3 backdrop-blur"
              >
                <span className="font-mono text-xl font-extrabold text-cyan-300">
                  {stat.val}
                </span>
                <span className="text-[11px] font-mono text-neutral-400 uppercase">
                  {stat.label}
                </span>
                <span className="text-[9px] font-mono text-neutral-600">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <a
          href="#multiplicity"
          className="absolute bottom-6 flex flex-col items-center gap-1 font-mono text-[10px] text-neutral-500 hover:text-cyan-400 transition-colors"
        >
          <span>SCROLL TO MULTIPLICITY ENGINE</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </a>
      </section>

      {/* =========================================================================
          SECTION 2 (100vh): PREDICTIVE MULTIPLICITY & STABILITY VERDICTS
         ========================================================================= */}
      <section
        id="multiplicity"
        className="relative flex h-screen w-full flex-col items-center justify-center border-t border-neutral-850 bg-[#060606] px-6 md:px-16"
      >
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2">
            <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Level 2 · Predictive Multiplicity Architecture
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-white">
              The Rashomon Effect in Clinical AI
            </h2>
            <p className="max-w-2xl text-sm text-neutral-400">
              In medical neuro-oncology, single-model predictions produce dangerous false confidence.
              VOID trains ~24 candidate models per marker and isolates the near-optimal ensemble (ε=0.03)
              to measure model agreement and epistemic uncertainty.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SpotlightCard className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                    STABLE
                  </span>
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="font-mono text-base font-bold text-white">Consensus Verdict</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  ≥85% of near-optimal models agree with interquartile probability spread ≤ 0.20.
                  Diagnostic accuracy on held-out test patients jumps to <strong>97.8%</strong> (error rate drops to <strong>2.2%</strong>).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-850 font-mono text-[10px] text-neutral-500">
                Action: Proceed to surgical planning with non-invasive molecular classification.
              </div>
            </SpotlightCard>

            <SpotlightCard className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-950/80 border border-amber-700/60 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                    CONTESTED
                  </span>
                  <GitBranch className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-mono text-base font-bold text-white">Epistemic Divergence</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Near-optimal models diverge across architectural families. Test error rate increases to <strong>42.9%</strong>,
                  directly flagging cases where image features alone cannot resolve genetic status.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-850 font-mono text-[10px] text-neutral-500">
                Action: Automated recommendation for confirmatory stereotactic biopsy or IDH immunohistochemistry.
              </div>
            </SpotlightCard>

            <SpotlightCard className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-400">
                    ARBITRARY
                  </span>
                  <Lock className="h-5 w-5 text-rose-400" />
                </div>
                <h3 className="font-mono text-base font-bold text-white">Equal Disagreement</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  The candidate pool splits evenly (~50/50) at the decision threshold. Any single model's
                  call would be completely arbitrary. VOID prevents catastrophic clinical overconfidence.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-850 font-mono text-[10px] text-neutral-500">
                Action: Model rejects standalone decision; triggers multidisciplinary tumor board review.
              </div>
            </SpotlightCard>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-4 font-mono text-xs">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-cyan-400 shrink-0" />
              <span className="text-neutral-300">
                <strong>Base-Rate Skill Safeguard:</strong> Models with skill &lt; 5% over naive prevalence
                (e.g. MGMT promoter) are automatically flagged as <em>"No reliable signal"</em>.
              </span>
            </div>
            <Link
              to="/cases"
              className="text-cyan-400 hover:text-white transition-colors underline shrink-0"
            >
              Test in Workspace →
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 (100vh): 3D MULTIPLANAR GPU NEUROIMAGING VIEWPORT
         ========================================================================= */}
      <section
        id="neuroimaging"
        className="relative flex h-screen w-full flex-col items-center justify-center border-t border-neutral-850 bg-[#030303] px-6 md:px-16"
      >
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2">
            <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Direct WebGL Hardware Raycasting
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-white">
              True 3D NIfTI Radiologic Viewport
            </h2>
            <p className="max-w-2xl text-sm text-neutral-400">
              Zero static images. VOID streams the patient's authentic multi-sequence volumes (T1, T1c, T2, FLAIR,
              and 3D tumor segmentation masks) directly into client-side WebGL via NiiVue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Viewport Feature List */}
            <div className="space-y-4">
              {[
                {
                  icon: <Layers className="h-5 w-5 text-cyan-400" />,
                  title: "Orthogonal Multiplanar Slicing",
                  desc: "Synchronized Axial, Sagittal, and Coronal views. Clicking any suspicious nodule cross-references 3D spatial voxel coordinates (X, Y, Z) instantly.",
                },
                {
                  icon: <Brain className="h-5 w-5 text-cyan-400" />,
                  title: "Clinical Grayscale & Discrete Lesion Masks",
                  desc: "Preserves clinical anatomical grayscale while superimposing sub-region segmentations: non-enhancing core (NCR), edema (ED), and enhancing tumor (ET).",
                },
                {
                  icon: <Cpu className="h-5 w-5 text-cyan-400" />,
                  title: "Bento-Box Modular Scratchpad",
                  desc: "Live drag-and-drop workspace layout with blueprint drop slots, allowing radiologists to customize multi-monitor viewing arrays.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 rounded-xl border border-neutral-850 bg-[#080808] p-4 transition-all hover:border-neutral-700"
                >
                  <div className="shrink-0">{item.icon}</div>
                  <div className="space-y-1">
                    <h4 className="font-mono text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Preview Mock Tile */}
            <div className="relative flex aspect-square flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#0a0a0a] shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between border-b border-neutral-850 bg-[#121212] px-4 py-2 font-mono text-xs">
                <span className="flex items-center gap-2 text-neutral-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  UCSF-PDGM-0018 (240×240×155 Voxel Matrix)
                </span>
                <span className="rounded bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 text-[10px] text-cyan-300">
                  WebGL 2.0 Active
                </span>
              </div>
              <div className="relative flex-1 flex items-center justify-center bg-gradient-to-br from-[#020202] via-[#090909] to-[#040404]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1),transparent_70%)]" />
                <div className="text-center space-y-3 z-10">
                  <Brain className="mx-auto h-20 w-20 text-cyan-500/80 animate-float" />
                  <div className="font-mono text-xs text-neutral-400">
                    <p className="text-neutral-200 font-bold">Interactive Hardware-Accelerated 3D Volume</p>
                    <p className="text-[10px] text-neutral-500">T1 · T1ce · T2 · FLAIR · Discrete Mask [0, 1, 2, 4]</p>
                  </div>
                  <Link
                    to="/cases/UCSF-PDGM-0018"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-950/60 px-3 py-1 font-mono text-xs text-cyan-200 hover:bg-cyan-900 transition-colors"
                  >
                    <span>Launch Full Viewport</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 (100vh): WHO 2021 CNS5 INTEGRATION & AUDIT PROVENANCE
         ========================================================================= */}
      <section
        id="biomarkers"
        className="relative flex h-screen w-full flex-col items-center justify-center border-t border-neutral-850 bg-[#060606] px-6 md:px-16"
      >
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2">
            <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Clinical Alignment & Interpretability
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-white">
              WHO 2021 CNS5 Gold-Standard Classification
            </h2>
            <p className="max-w-2xl text-sm text-neutral-400">
              Integrating molecular genetic taxonomy with explainable AI (SHAP effect grouping,
              tipping-evidence counterfactuals, and SHA-256 hash-chained audit trails).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                marker: "IDH1/2 Status",
                fused: "0.9772 AUC",
                given: "Astrocytoma vs Glioblastoma",
                desc: "Determines primary genetic bifurcation in adult diffuse gliomas.",
              },
              {
                marker: "1p/19q Codeletion",
                fused: "0.8974 AUC",
                given: "0.9744 given IDH",
                desc: "Defines Oligodendroglioma (requires both IDH-mutant and 1p/19q loss).",
              },
              {
                marker: "MGMT Promoter",
                fused: "0.5525 AUC",
                given: "Flagged 'Low Signal'",
                desc: "Temozolomide chemotherapy response prediction (safeguarded against false consensus).",
              },
              {
                marker: "WHO CNS Grade",
                fused: "0.9988 AUC",
                given: "Grade 4 vs 2–3",
                desc: "Distinguishes high-grade necrosis and vascular proliferation from lower-grade lesions.",
              },
            ].map((card, i) => (
              <SpotlightCard key={i} className="flex flex-col justify-between">
                <div className="space-y-2">
                  <Dna className="h-5 w-5 text-cyan-400" />
                  <h4 className="font-mono text-sm font-bold text-white">{card.marker}</h4>
                  <div className="font-mono text-lg font-extrabold text-cyan-300">
                    {card.fused}
                  </div>
                  <span className="inline-block rounded bg-[#161616] px-2 py-0.5 font-mono text-[10px] text-neutral-400 border border-neutral-800">
                    {card.given}
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-normal pt-1">{card.desc}</p>
                </div>
              </SpotlightCard>
            ))}
          </div>

          {/* Audit Trail & Compliance Footer inside Section 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-neutral-850 bg-[#090909] p-3.5">
              <FileCheck2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="font-mono text-xs">
                <span className="font-bold text-white block">Hash-Chained Audit Trail</span>
                <span className="text-[10px] text-neutral-400">Cryptographically verifiable SHA-256 logs for every prediction.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-neutral-850 bg-[#090909] p-3.5">
              <Database className="h-5 w-5 text-cyan-400 shrink-0" />
              <div className="font-mono text-xs">
                <span className="font-bold text-white block">Zero Data Leakage</span>
                <span className="text-[10px] text-neutral-400">Deduplicated single-scan patient splits. Follow-ups excluded.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-neutral-850 bg-[#090909] p-3.5">
              <Cpu className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="font-mono text-xs">
                <span className="font-bold text-white block">Tipping Counterfactuals</span>
                <span className="text-[10px] text-neutral-400">Quantifies exactly what feature shift would overturn the diagnostic call.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: FOOTER (Clean Clinical Obsidian Finish)
         ========================================================================= */}
      <footer className="border-t border-neutral-850 bg-[#030303] py-12 px-6 md:px-16 font-mono text-xs text-neutral-500">
        <div className="mx-auto flex max-w-6xl flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-cyan-400" />
            <span className="font-bold text-neutral-300">VOID CLINICAL AI</span>
            <span>·</span>
            <span>Manipal Hackathon 2026</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <Link to="/cases" className="hover:text-cyan-400 transition-colors">
              Patient Cohort
            </Link>
            <Link to="/login" className="hover:text-cyan-400 transition-colors">
              Clinician Login
            </Link>
            <a
              href="https://github.com/Manipal-Hackathon-2026/Void"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              GitHub Repository
            </a>
          </div>

          <div className="text-[10px] text-neutral-600">
            For Investigational & Decision-Support Use Only.
          </div>
        </div>
      </footer>
    </div>
  )
}
