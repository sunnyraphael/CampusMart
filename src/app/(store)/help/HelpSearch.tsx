'use client'
import { useState } from 'react'

export default function HelpSearch({topics}:{topics:{question:string;answer:string}[]}) {
  const [query,setQuery]=useState('')
  const matches=topics.filter((t)=>`${t.question} ${t.answer}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="buyer-panel"><label className="buyer-label">Search help<input className="buyer-input" type="search" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Try delivery, password or payments"/></label>
    {!matches.length&&<p role="status">No answers match. Try another term or contact support.</p>}
    {matches.map((t)=><details className="buyer-faq" key={t.question}><summary>{t.question}</summary><p>{t.answer}</p></details>)}
  </section>
}
