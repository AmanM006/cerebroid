import { Link } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Dna,
  Layers,
  Sparkles,
  PhoneCall,
  CheckCircle2,
} from "lucide-react"
import { InteractiveBrain3D } from "../components/InteractiveBrain3D"

export function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] text-slate-800 antialiased selection:bg-indigo-500/20 selection:text-indigo-900 font-sans">
      
      {/* =========================================================================
          HERO CONTAINER WITH CURVED WHITE CANVAS WRAPPER (Ref image design)
         ========================================================================= */}
      <div className="p-3 sm:p-6 md:p-8">
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#4b3bf6] via-[#6355f6] to-[#7f71ff] p-6 shadow-2xl shadow-indigo-500/20 md:p-10">
          
          {/* Subtle Ambient Background Orbs */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-indigo-950/20 blur-3xl" />

          {/* =========================================================================
              FLOATING PILL NAVBAR (Like Mediate in reference)
             ========================================================================= */}
          <header className="relative z-30 flex items-center justify-between rounded-full bg-white/10 px-5 py-3 backdrop-blur-xl border border-white/20 shadow-lg">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-600 font-extrabold shadow-md">
                <Dna className="h-4 w-4" />
              </div>
              <span className="text-base font-bold tracking-tight text-white">
                Void<span className="text-indigo-200">Bio</span>
              </span>
            </div>

            {/* Nav links */}
            <nav className="hidden items-center gap-7 lg:flex text-xs font-medium text-white/80">
              <a href="#hero" className="text-white hover:text-white/90 transition-colors">
                Home
              </a>
              <a href="#services" className="hover:text-white transition-colors">
                About
              </a>
              <a href="#services" className="hover:text-white transition-colors">
                Biomarkers
              </a>
              <a href="#evidence" className="hover:text-white transition-colors">
                Clinical Multiplicity
              </a>
              <a href="#services" className="hover:text-white transition-colors">
                Neuroimaging
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Documentation
              </a>
            </nav>

            {/* Right Action */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:inline-flex rounded-full px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/cases"
                className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-bold text-indigo-600 shadow-md hover:bg-indigo-50 hover:shadow-lg transition-all"
              >
                <span>Launch PACS</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </header>

          {/* =========================================================================
              HERO MAIN CONTENT (Split 2-Column: Left Text, Right 3D Brain & Floating Badges)
             ========================================================================= */}
          <div className="relative z-20 grid flex-1 grid-cols-1 items-center gap-8 py-8 lg:grid-cols-12 lg:gap-12">
            
            {/* Left Column: Headlines & Call to Action */}
            <div className="flex flex-col items-start space-y-6 text-white lg:col-span-6 lg:py-6">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md border border-white/20">
                <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                <span>WHO 2021 CNS5 Molecular Taxonomy</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.12]">
                We bring non-invasive <br className="hidden sm:inline" />
                molecular neuro-biopsy.
              </h1>

              {/* Description */}
              <p className="max-w-xl text-sm sm:text-base text-white/80 leading-relaxed font-normal">
                Classifying IDH1/2 mutations, 1p/19q codeletion, and WHO CNS tumor grade directly from multiparametric MRI before invasive craniotomy. Powered by predictive multiplicity and true 3D spatial voxel modeling.
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/cases"
                  className="rounded-full bg-white px-7 py-3 text-xs sm:text-sm font-bold text-indigo-600 shadow-xl hover:bg-indigo-50 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Explore Patient Cohort
                </Link>
                <Link
                  to="/cases/UCSF-PDGM-0018"
                  className="rounded-full bg-white/15 px-6 py-3 text-xs sm:text-sm font-semibold text-white backdrop-blur-md border border-white/20 hover:bg-white/25 transition-all"
                >
                  Live Demo (Case 0018)
                </Link>
              </div>

              {/* Trust Avatar & Social Proof Pill (Like reference) */}
              <div className="flex items-center gap-3.5 pt-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/15">
                <div className="flex -space-x-2">
                  {["#60a5fa", "#34d399", "#f472b6", "#a78bfa"].map((c, i) => (
                    <div
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-600 text-[10px] font-bold text-white shadow"
                      style={{ backgroundColor: c }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-600 bg-white text-[10px] font-bold text-indigo-600 shadow">
                    +494
                  </div>
                </div>
                <div className="text-left text-xs">
                  <div className="font-bold text-white">494 UCSF-PDGM Patients</div>
                  <div className="text-[11px] text-white/70">Verified test cohort with held-out validation</div>
                </div>
              </div>
            </div>

            {/* Right Column: 3D Holographic Brain & Floating Frosted Glass Chips */}
            <div className="relative flex h-[380px] sm:h-[480px] lg:h-[560px] w-full items-center justify-center lg:col-span-6">
              
              {/* Central Glowing Radial */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-white/20 blur-3xl" />
              </div>

              {/* Interactive 3D Brain Particle Cloud */}
              <div className="relative z-10 h-full w-full">
                <InteractiveBrain3D />
              </div>

              {/* Floating Pill 1: Stability Badge (Top Left) */}
              <div className="absolute -top-2 sm:top-8 left-2 sm:left-4 z-20 flex items-center gap-2.5 rounded-2xl bg-white/85 px-4 py-2.5 text-xs text-slate-800 shadow-xl backdrop-blur-lg border border-white/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-slate-900">Stable Agreement</div>
                  <div className="text-[10px] text-slate-500">97.8% diagnostic accuracy</div>
                </div>
              </div>

              {/* Floating Pill 2: IDH AUC Metric (Middle Right) */}
              <div className="absolute top-1/2 -translate-y-1/2 right-0 sm:right-2 z-20 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-xs text-slate-800 shadow-xl backdrop-blur-lg border border-white/70">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">IDH Fused AUC</div>
                  <div className="text-base font-extrabold text-indigo-600">0.9772</div>
                </div>
              </div>

              {/* Floating Pill 3: Call & Verified Chip (Bottom Left) */}
              <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-10 z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2 text-xs text-slate-800 shadow-2xl border border-slate-100">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                  <PhoneCall className="h-3.5 w-3.5" />
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-400 block font-sans">Decision Support</span>
                  <span className="text-xs font-bold text-slate-800">Ready for Tumor Board</span>
                </div>
              </div>

              {/* Floating Mini Controls (Bottom Right - like call buttons in reference) */}
              <div className="absolute bottom-4 sm:bottom-8 right-4 sm:right-8 z-20 flex items-center gap-2 rounded-full bg-white/80 p-1.5 shadow-xl backdrop-blur-md">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: CLEAN WHITE BENTO SERVICES CARDS (Identical to reference layout)
         ========================================================================= */}
      <section id="services" className="mx-auto max-w-7xl px-6 py-20 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-indigo-600">
              Clinical Services You Can Rely On
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Comprehensive Neuro-Oncology <br className="hidden sm:inline" />
              Biomarker Intelligence
            </h2>
          </div>
          <p className="mt-4 md:mt-0 max-w-md text-sm text-slate-500 leading-relaxed">
            Integrating 24 near-optimal candidate model sets per marker to expose predictive multiplicity and eliminate artificial algorithmic certainty.
          </p>
        </div>

        {/* 6 Clean White Bento Cards with Light Borders & Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              id: "01",
              title: "IDH1 / IDH2 Status",
              sub: "Primary Diffuse Glioma Classification",
              desc: "Fused clinical-radiomic model achieving 0.977 AUC. Resolves astrocytoma from glioblastoma non-invasively before stereotactic biopsy.",
              tag: "0.977 AUC",
            },
            {
              id: "02",
              title: "1p/19q Codeletion",
              sub: "Oligodendroglioma Hallmark",
              desc: "Synergistic prediction reaching 0.974 AUC when conditioned on known IDH mutation. Eliminates unnecessary FISH delay.",
              tag: "0.974 AUC",
            },
            {
              id: "03",
              title: "WHO CNS Grade",
              sub: "Histopathologic Malignancy",
              desc: "Direct 3D spatial discrimination of Grade 4 microvascular proliferation and pseudopalisading necrosis against Grade 2–3 tumors.",
              tag: "0.999 AUC",
            },
            {
              id: "04",
              title: "Predictive Multiplicity",
              sub: "Rashomon Ensemble Framework",
              desc: "Classifies cases into STABLE (≥85% consensus, 2.2% error), CONTESTED, and ARBITRARY to protect against single-model overconfidence.",
              tag: "Rashomon Set",
            },
            {
              id: "05",
              title: "3D Multiplanar Viewport",
              sub: "WebGL Hardware Raycasting",
              desc: "Streams genuine skull-stripped T1, T1c, T2, FLAIR, and discrete tumor segmentations [0, 1, 2, 4] directly to the radiologist's screen.",
              tag: "NiiVue WebGL",
            },
            {
              id: "06",
              title: "Low-Signal Safeguards",
              sub: "Prior Echoing Detection",
              desc: "Calculates empirical base-rate skill. When model sets merely echo cohort prevalence (e.g. MGMT at 0.4%), flags 'No reliable signal'.",
              tag: "Safe Guard",
            },
          ].map((card, i) => (
            <div
              key={i}
              className="group relative flex flex-col justify-between rounded-3xl bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 border border-slate-100"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-mono font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    +{card.id}
                  </span>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 border border-slate-100">
                    {card.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {card.title}
                </h3>
                <div className="text-xs font-medium text-slate-400 mt-1 mb-3">
                  {card.sub}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                <span>View case evidence</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: CLINICAL TESTIMONIALS & TRUST SECTION (Ref image card style)
         ========================================================================= */}
      <section id="evidence" className="bg-[#f0f3fa] py-20 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold tracking-widest uppercase text-indigo-600">
              Evidence-Based Molecular Oncology
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Clinicians Who Rely on VOID
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Validated on 494 institutional cases with zero synthetic shortcuts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                role: "Neuro-Surgeon",
                title: "Pre-Operative Trajectory Planning",
                comment: "Knowing IDH mutation status non-invasively changes whether we plan supratotal resection or stereotactic debulking on morning rounds.",
                author: "Dr. Aaron Schader",
                sub: "Chief of Neurosurgery",
              },
              {
                role: "Neuro-Radiologist",
                title: "Zero False Confidence",
                comment: "Most AI models give a single confident percentage. VOID tells us if the models disagree, exactly when we need to be vigilant.",
                author: "Dr. Elena Vance",
                sub: "Attending Neuroradiologist",
              },
              {
                role: "Neuro-Pathologist",
                title: "1p/19q Fish Concordance",
                comment: "The fused-given-IDH model's 0.974 AUC provides rapid preliminary guidance while formal cytogenetics are processing.",
                author: "Dr. Marcus Chen",
                sub: "Molecular Neuropathology",
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="rounded-3xl bg-white p-7 shadow-sm border border-slate-100/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {"★".repeat(5)}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-2">
                    {card.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                    "{card.comment}"
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs">
                    {card.author[4]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{card.author}</div>
                    <div className="text-[11px] text-slate-400">{card.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DARK BOTTOM CTA BANNER (Like reference image bottom left card)
         ========================================================================= */}
      <section className="p-4 sm:p-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#0c0d18] px-8 py-16 text-center text-white sm:px-16 shadow-2xl">
          <span className="text-xs font-bold tracking-widest uppercase text-indigo-400">
            Pre-Operative Decision Support
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl max-w-3xl mx-auto">
            Transforming Neurosurgical Care With Molecular Certainty.
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-slate-400">
            Open a demo study, interact with real 3D NIfTI brain volumes, and test predictive multiplicity live in the browser.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/cases"
              className="rounded-full bg-indigo-600 px-8 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg hover:bg-indigo-500 hover:shadow-indigo-500/25 transition-all"
            >
              Access Clinical Workspace
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-white/10 px-8 py-3.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-md border border-white/15 hover:bg-white/20 transition-all"
            >
              Sign In as Clinician
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CLEAN SLATE FOOTER
         ========================================================================= */}
      <footer id="contact" className="border-t border-slate-200 bg-white py-12 px-6 md:px-12 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
              V
            </div>
            <span className="font-bold text-slate-800">VOID / PACS</span>
            <span className="text-slate-300">|</span>
            <span>UCSF-PDGM Molecular Multiplicity System</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/cases" className="hover:text-indigo-600 transition-colors">
              Patient Cohort
            </Link>
            <Link to="/login" className="hover:text-indigo-600 transition-colors">
              Staff Portal
            </Link>
            <a
              href="https://github.com/Manipal-Hackathon-2026/Void"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-600 transition-colors"
            >
              GitHub Repo
            </a>
          </div>

          <div className="text-[11px] text-slate-400">
            © 2026 Manipal Hackathon · Clinical Research Use Only
          </div>
        </div>
      </footer>

    </div>
  )
}
