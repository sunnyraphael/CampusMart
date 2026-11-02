import {Frame,Heading,Panel,Rows} from '@/components/loading/Primitives'
export default function Loading(){return <Frame variant="admin-store-details"><Heading/><Rows count={2}/><div className="store-directory">{[0,1].map(i=><Panel key={i}><Rows count={6}/></Panel>)}</div><Panel><Rows count={3}/></Panel></Frame>}
