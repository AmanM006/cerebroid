import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { ErrorNotice } from "./ErrorNotice"

const FILES=[
  { id: "t1", label: "T1" },
  { id: "t1c", label: "T1 contrast (T1c / T1Gd)" },
  { id: "t2", label: "T2" },
  { id: "flair", label: "FLAIR" },
  { id: "seg", label: "Tumor mask (1 necrotic, 2 edema, 4 enhancing)" },
] as const
type FileId=(typeof FILES)[number]["id"]
const MAX_MB=40

/**
 * Upload a new patient's MRI: four skull-stripped, co-registered sequences plus the tumor mask,
 * with age and sex. The server validates and processes it in the background; when ready, the case
 * opens with the same analysis as the demo cases.
 */
export function UploadStudy({ onDone }: { onDone: ()=>void }) {
  const navigate=useNavigate()
  const [files, setFiles]=useState<Partial<Record<FileId, File>>>({})
  const [age, setAge]=useState("")
  const [sex, setSex]=useState<"" | "M" | "F">("")
  const [label, setLabel]=useState("")
  // Lab results the user already has, kept only to compare against on "Reveal lab results".
  const [lab, setLab]=useState<Record<string, string>>({})
  const labelOk=label==="" || /^[A-Za-z0-9 ._#()-]{1,40}$/.test(label)
  const [phase, setPhase]=useState<"idle" | "uploading" | "processing">("idle")
  const [error, setError]=useState<unknown>(null)
  const [failure, setFailure]=useState<string | null>(null)
  const polling=useRef(true)

  useEffect(()=>{
    polling.current=true
    return ()=>{
      polling.current=false
    }
  }, [])

  const ageNumber=Number(age)
  const tooLarge=Object.values(files).some((f)=>f && f.size>MAX_MB*1024*1024)
  const ready=FILES.every((f)=>files[f.id]) && Number.isInteger(ageNumber) && ageNumber>=18 && ageNumber<=100 && labelOk
    && sex!=="" && !tooLarge

  const [progressStep, setProgressStep] = useState<string>("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ready || phase!=="idle") return
    setError(null)
    setFailure(null)
    polling.current = true
    const form=new FormData()
    form.append("age", String(ageNumber))
    form.append("sex", sex)
    if (label.trim()) form.append("label", label.trim())
    for (const [k, v] of Object.entries(lab)) if (v) form.append(k, v)
    for (const f of FILES) form.append(f.id, files[f.id] as File)
    setPhase("uploading")
    setProgressStep("Uploading 3D NIfTI volumes and validating header geometry…")
    try {
      const started=await api.uploadStudy(form)
      setPhase("processing")
      setProgressStep("Extracting radiomics features & predicting molecular targets…")
      // Notify parent table right away so case appears in table as PROCESSING (yellow badge)
      onDone()
      for (let i=0; i<150 && polling.current; i++) {
        await new Promise((resolve)=>setTimeout(resolve, 2000))
        const status=await api.uploadStatus(started.study_id)
        if (status.status==="ready") {
          setProgressStep("Analysis complete! Opening clinical workstation…")
          onDone()
          setTimeout(() => {
            navigate(`/cases/${started.study_id}`)
          }, 800)
          return
        }
        if (status.status==="failed") {
          setFailure(`${status.message ?? "Processing failed."} (${status.error_code})`)
          setPhase("idle")
          onDone()
          return
        }
      }
      setFailure("Processing is taking longer than expected. It will appear in your case list as soon as feature extraction finishes.")
      setPhase("idle")
    } catch (err) {
      setError(err)
      setPhase("idle")
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[#09090b] p-5 font-mono text-xs shadow-2xl transition-all">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <p className="text-sm font-bold tracking-tight text-white uppercase">Analyse a new MRI</p>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Skull-stripped, co-registered NIfTI volumes (.nii or .nii.gz, up to {MAX_MB} MB each) on one voxel grid.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-[10px] text-neutral-300 font-medium">
          🔒 Private to your account · 24h retention
        </span>
      </div>

      {/* Inputs Grid */}
      <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {FILES.map((f)=>{
          const selected = Boolean(files[f.id])
          return (
            <label key={f.id} className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all cursor-pointer ${
              selected ? "border-cyan-500/60 bg-[#0c1622]/60 text-white" : "border-neutral-800 bg-[#0f0f12] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-neutral-300">{f.label}</span>
                {selected && <span className="text-cyan-400 font-bold text-xs">✓</span>}
              </div>
              <input
                type="file"
                accept=".nii,.gz,application/gzip"
                disabled={phase!=="idle"}
                onChange={(e)=>setFiles((prev)=>({ ...prev, [f.id]: e.target.files?.[0] }))}
                className="block w-full text-[10.5px] text-neutral-400 file:mr-2 file:rounded-md file:border file:border-neutral-700 file:bg-neutral-800 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-neutral-200 file:cursor-pointer"
              />
            </label>
          )
        })}
        
        {/* Patient Demographics */}
        <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0f0f12] p-2.5">
          <label className="flex-1 space-y-1">
            <span className="text-[11px] font-semibold text-neutral-300 block">Age (18–100)</span>
            <input 
              type="number" min={18} max={100} required value={age} disabled={phase!=="idle"} placeholder="Age"
              onChange={(e)=>setAge(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 font-mono focus:border-cyan-500 focus:outline-none" 
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-[11px] font-semibold text-neutral-300 block">Sex</span>
            <select 
              required value={sex} disabled={phase!=="idle"}
              onChange={(e)=>setSex(e.target.value as "" | "M" | "F")}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
            >
              <option value="">– Select –</option>
              <option value="F">Female (F)</option>
              <option value="M">Male (M)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="space-y-1 rounded-xl border border-neutral-800 bg-[#0f0f12] p-2.5">
          <span className="text-[11px] font-semibold text-neutral-300 block">Case label (optional)</span>
          <input
            type="text" maxLength={40} value={label} disabled={phase!=="idle"} placeholder="e.g. Case A - TCGA 289"
            onChange={(e)=>setLabel(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 font-mono focus:border-cyan-500 focus:outline-none"
          />
          <span className={`block text-[10px] ${labelOk ? "text-neutral-500" : "text-rose-300"}`}>
            {labelOk ? "Not a real name. Letters, numbers, spaces and . _ # ( ) -" : "Only letters, numbers, spaces and . _ # ( ) - (max 40)"}
          </span>
        </label>
        <div className="space-y-1.5 rounded-xl border border-neutral-800 bg-[#0f0f12] p-2.5">
          <span className="text-[11px] font-semibold text-neutral-300 block">
            Lab results to compare (optional, not used by the model)
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-400 block">IDH</span>
            <select value={lab.lab_idh ?? ""} disabled={phase!=="idle"}
              onChange={(e)=>setLab((prev)=>({ ...prev, lab_idh: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none">
              <option value="">Unknown</option>
              <option value="mutant">Mutant</option>
              <option value="wildtype">Wildtype</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-400 block">1p/19q</span>
            <select value={lab.lab_1p19q ?? ""} disabled={phase!=="idle"}
              onChange={(e)=>setLab((prev)=>({ ...prev, lab_1p19q: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none">
              <option value="">Unknown</option>
              <option value="codeleted">Codeleted</option>
              <option value="intact">Intact</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-400 block">MGMT</span>
            <select value={lab.lab_mgmt ?? ""} disabled={phase!=="idle"}
              onChange={(e)=>setLab((prev)=>({ ...prev, lab_mgmt: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none">
              <option value="">Unknown</option>
              <option value="methylated">Methylated</option>
              <option value="unmethylated">Unmethylated</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-400 block">WHO grade</span>
            <select value={lab.lab_grade ?? ""} disabled={phase!=="idle"}
              onChange={(e)=>setLab((prev)=>({ ...prev, lab_grade: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none">
              <option value="">Unknown</option>
              <option value="2">Grade 2</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
            </select>
          </label>
          </div>
        </div>
      </div>

      {/* Processing / Loading State Overlay */}
      {phase !== "idle" && (
        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 shadow-lg backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <div className="flex-1">
              <p className="text-xs font-bold text-cyan-200 tracking-wide uppercase">
                {phase === "uploading" ? "1/2 Uploading Patient Scans" : "2/2 Extracting Radiomics & Predicting Molecular Targets"}
              </p>
              <p className="text-[11px] text-cyan-400/90 mt-0.5">{progressStep}</p>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 ${phase === "uploading" ? "w-1/3" : "w-4/5"}`} />
          </div>
        </div>
      )}

      {/* Error & Alerts */}
      {tooLarge && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
          ⚠️ One or more files exceeds the {MAX_MB} MB limit; please compress with gzip (.nii.gz).
        </div>
      )}
      {failure && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">
          ⚠️ {failure}
        </div>
      )}
      {error !== null && <ErrorNotice error={error} />}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-neutral-400">
          {!ready ? "Select all 5 NIfTI files, age and sex to run analysis" : "All 5 co-registered volumes and clinical context verified"}
        </span>
        <button 
          type="submit" 
          disabled={!ready || phase!=="idle"}
          className="flex items-center gap-2 rounded-xl border border-white bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-md"
        >
          {phase === "uploading" && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />}
          {phase === "processing" && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />}
          {phase === "uploading" ? "Uploading Scans…" : phase === "processing" ? "Extracting Features…" : "Upload & Run Analysis"}
        </button>
      </div>
    </form>
  )
}
