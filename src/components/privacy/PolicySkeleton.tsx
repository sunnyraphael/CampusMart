import { Block, Button, Frame, Lines } from '@/components/loading/Primitives'
import styles from './PolicyPage.module.css'

export default function PolicySkeleton() {
  return <Frame variant="policy" className={styles.page}><header className={styles.hero}><Block width={170} height={12}/><Block width="min(450px,95%)" height={39} style={{margin:'15px 0'}}/><Block width="min(560px,100%)" height={22}/><Block width={240} height={17} style={{marginTop:18}}/></header><div className={styles.policyNav}>{[85,110,115,135,85].map((width,i)=><Button key={i} width={width}/>)}</div><div className={styles.highlights}>{[0,1,2].map(i=><div key={i}><Block width={18} height={18}/><Block width="85%" height={18}/></div>)}</div><div className={styles.layout}><aside className={styles.index}><Lines count={9}/></aside><article className={styles.article}>{[0,1,2].map(i=><section key={i}><Block width="65%" height={24} style={{marginBottom:18}}/><Lines count={5}/></section>)}</article></div></Frame>
}
