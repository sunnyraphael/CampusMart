import { Block,Button,Frame,Heading,Panel,Rows } from '@/components/loading/Primitives'
export default function Loading(){return <Frame variant="admin-payments"><Heading/><Block height={90}/><div className="buyer-actions"><Block width={250} height={44}/><Button width={190}/></div><Block width={170} height={24}/>{[0,1].map(i=><Panel key={i}><Rows count={3}/><Button width={160}/></Panel>)}</Frame>}
