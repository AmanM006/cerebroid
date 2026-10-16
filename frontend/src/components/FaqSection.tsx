import type { ReactNode } from "react"

/**
 * Plain-language answers to what clinicians and reviewers ask first. The only number shown
 * (held-out IDH AUC) comes from the live metrics endpoint, never from this file.
 */
export function FaqSection({ idhAuc }: { idhAuc: string }) {
  const faqs: { q: string; a: ReactNode }[]=[
    {
      q: "Does Cerebroid replace a biopsy?",
      a: "No. The lab result always wins. Cerebroid works before surgery, when the only information is the MRI, and every call tells the doctor to confirm it with tissue.",
    },
    {
      q: "Why would a doctor use it instead of their usual methods?",
      a: "It doesn't compete with tissue testing. Before surgery, doctors read the MRI by eye without a measured accuracy. Cerebroid gives a measured estimate in that gap: for planning surgery, choosing which lab test to order first, and as a documented second read at the tumor board while results take days to weeks.",
    },
    {
      q: "What happens if a prediction is wrong?",
      a: "Cerebroid is built so a wrong call is flagged or caught, not acted on. Uncertain calls show Contested or Arbitrary, scans unlike the training data show \"Unlike training scans\", markers the MRI can't predict show \"MRI can't tell\", and every result is logged with the exact model version. It never tells anyone to skip a test.",
    },
    {
      q: "What is the most dangerous mistake it could make?",
      a: "Calling a grade 4 glioblastoma \"grade 2–3\", because a team might wait. A grade 4 alert, with its threshold chosen on cross-validation to miss none there, flags those cases, and the safety rules say never to watch and wait on a grade 2–3 call without tissue.",
    },
    {
      q: "How accurate is it?",
      a: <>On held-out patients the models never saw, IDH status is predicted with an AUC of <b className="text-white">{idhAuc}</b> (1.0 is perfect, 0.5 is guessing). Full results, including patients from other hospitals, are in the Training data card inside the app.</>,
    },
    {
      q: "What do Stable, Contested and Arbitrary mean?",
      a: "Each result is checked by a panel of equally good models. Stable: they agree. Contested: they disagree, or agree but with very different confidence. Arbitrary: they are split close to 50/50. Anything but Stable means confirm with tissue.",
    },
    {
      q: "Why doesn't the model use race?",
      a: "Race is a social category, not a tumor mechanism, and using it as an input risks building in bias. We evaluate results across groups instead. The biggest measured difference between populations came from scanners and hospitals, so we trained on patients from many hospitals.",
    },
    {
      q: "Why not data from Europe, Asia or Africa?",
      a: "The main European dataset (Erasmus Glioma Database, Netherlands) needs a signed data-use agreement and is our next validation set. We found no public Asian dataset with both MRI and molecular results, and the African BraTS set has no molecular labels yet.",
    },
    {
      q: "Is patient data safe?",
      a: "Only skull-stripped scans are accepted, so faces can't be reconstructed. Header text is stripped, no names or dates of birth are stored, and uploads are deleted after 24 hours.",
    },
    {
      q: "Is it approved for clinical use?",
      a: "No. It is a research prototype. The path to a clinic is a silent trial alongside doctors at each hospital, validation on that hospital's scanners, then regulatory approval as medical software.",
    },
  ]

  return (
    <section aria-labelledby="faq-title" className="relative w-full bg-black px-8 sm:px-14 lg:px-20 py-16 border-t border-neutral-900">
      <div className="w-full max-w-4xl mx-auto">
        <h2 id="faq-title" className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Questions doctors ask</h2>
        <div className="mt-8 divide-y divide-neutral-800 rounded-2xl border border-neutral-800 bg-neutral-950/80">
          {faqs.map((f)=>(
            <details key={f.q} className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                {f.q}
                <span className="shrink-0 text-neutral-500 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
