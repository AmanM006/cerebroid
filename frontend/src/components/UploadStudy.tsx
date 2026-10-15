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
  const [phase, setPhase]=useState<"idle" | "uploading" | "processing">("idle")
  const [error, setError]=useState<unknown>(null)
  const [failure, setFailure]=useState<string | null>(null)
  const polling=useRef(true)

  useEffect(()=>()=>{
    polling.current=false
  }, [])

  const ageNumber=Number(age)
  const tooLarge=Object.values(files).some((f)=>f && f.size>MAX_MB*1024*1024)
  const ready=FILES.every((f)=>files[f.id]) && Number.isInteger(ageNumber) && ageNumber>=18 && ageNumber<=100
    && sex!=="" && !tooLarge

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ready || phase!=="idle") return
    setError(null)
    setFailure(null)
    const form=new FormData()
    form.append("age", String(ageNumber))
    form.append("sex", sex)
    for (const f of FILES) form.append(f.id, files[f.id] as File)
    setPhase("uploading")
    try {
      const started=await api.uploadStudy(form)
      setPhase("processing")
      for (let i=0; i<150 && polling.current; i++) {
        await new Promise((resolve)=>setTimeout(resolve, 2000))
        const status=await api.uploadStatus(started.study_id)
        if (status.status==="ready") {
          onDone()
          navigate(`/cases/${started.study_id}`)
          return
        }
        if (status.status==="failed") {
          setFailure(`${status.message ?? "Processing failed."} (${status.error_code})`)
          setPhase("idle")
          onDone()
          return
        }
      }
      setFailure("Still processing. It will appear in the case list when ready.")
      setPhase("idle")
    } catch (err) {
      setError(err)
      setPhase("idle")
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-4 font-mono text-xs">
      <div>
        <p className="text-sm font-bold text-white">Analyse a new MRI</p>
        <p className="text-[11px] text-neutral-400">
          Skull-stripped, co-registered NIfTI volumes (.nii or .nii.gz, up to {MAX_MB} MB each) on one voxel grid,
          plus a tumor mask with BraTS labels. Do not upload identifiable data. Uploads are private to your account
          and deleted after 24 hours.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {FILES.map((f)=>(
          <label key={f.id} className="space-y-1">
            <span className="text-[11px] text-neutral-300">{f.label}</span>
            <input
              type="file"
              accept=".nii,.gz,application/gzip"
              disabled={phase!=="idle"}
              onChange={(e)=>setFiles((prev)=>({ ...prev, [f.id]: e.target.files?.[0] }))}
              className="block w-full text-[11px] text-neutral-400 file:mr-2 file:rounded-md file:border file:border-neutral-700 file:bg-neutral-900 file:px-2 file:py-1 file:text-neutral-200"
            />
          </label>
        ))}
        <div className="flex gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-300">Age</span>
            <input type="number" min={18} max={100} required value={age} disabled={phase!=="idle"}
              onChange={(e)=>setAge(e.target.value)}
              className="block w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-300">Sex</span>
            <select required value={sex} disabled={phase!=="idle"}
              onChange={(e)=>setSex(e.target.value as "" | "M" | "F")}
              className="block rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-white">
              <option value="">–</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </label>
        </div>
      </div>

      {tooLarge && <p className="text-[11px] text-rose-300">A file is larger than {MAX_MB} MB; compress it as .nii.gz.</p>}
      {failure && <p className="text-[11px] text-rose-300">{failure}</p>}
      {error!==null && <ErrorNotice error={error} />}

      <button type="submit" disabled={!ready || phase!=="idle"}
        className="rounded-lg border border-white bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:opacity-40">
        {phase==="uploading" ? "Uploading…" : phase==="processing" ? "Extracting features…" : "Upload and analyse"}
      </button>
    </form>
  )
}
