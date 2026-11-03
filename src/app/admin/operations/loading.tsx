import {Frame,Heading,Panel,Rows} from '@/components/loading/Primitives'
export default function Loading(){return <Frame variant="admin-operations"><Heading/><div className="store-directory">{[0,1,2,3].map(i=><Panel key={i}><Rows count={2}/></Panel>)}</div><Panel><Rows count={6}/></Panel></Frame>}
