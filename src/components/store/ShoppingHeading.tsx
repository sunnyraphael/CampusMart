import type { ReactNode } from 'react'

export default function ShoppingHeading({eyebrow='Campus marketplace',title,description,actions}:{eyebrow?:string;title:string;description:string;actions?:ReactNode}) {
  return <header className="sh-heading"><div><p className="sh-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="sh-description">{description}</p></div>{actions&&<div className="buyer-actions">{actions}</div>}</header>
}
