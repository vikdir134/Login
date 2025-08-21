import { useState } from 'react'
import AddFinishedModal from '../components/AddFinishedModal'
import CatalogQuickModal from '../components/CatalogQuickModal'

export default function Almacen() {
  const [openFinished, setOpenFinished] = useState(false)
  const [openCatalog, setOpenCatalog] = useState(false)
  const [msg, setMsg] = useState('')

  const afterDone = () => {
    setMsg('✅ Operación realizada')
    // TODO: refrescar KPIs/tabla
  }

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin:0 }}>Almacén</h3>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={() => setOpenFinished(true)}>+ Agregar Producto Terminado</button>
          <button className="btn-secondary" onClick={() => setOpenCatalog(true)}>Extras</button>
        </div>
      </div>

      <p className="muted">Gestión de producto terminado y presentaciones.</p>

      {msg && <div className="muted" style={{ marginTop:12 }}>{msg}</div>}

      <AddFinishedModal
        open={openFinished}
        onClose={()=>setOpenFinished(false)}
        onDone={afterDone}
      />

      <CatalogQuickModal
        open={openCatalog}
        onClose={()=>setOpenCatalog(false)}
      />
    </section>
  )
}
