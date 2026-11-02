import {Frame,Heading,Panel,Rows,Field} from '@/components/loading/Primitives'
export default function Loading(){return <Frame variant="admin-stores"><Heading/><Field/><div className="store-directory store-directory-compact">{[0,1,2,3].map(i=><Panel key={i}><Rows count={2}/></Panel>)}</div></Frame>}
