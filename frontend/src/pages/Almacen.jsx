// src/pages/Almacen.jsx
import { useState } from 'react'
import Modal from '../components/Modal'
import { hasRole, getUserFromToken } from '../utils/auth'

import CreatePrimaryMaterialForm from '../components/forms/CreatePrimaryMaterialForm'
import CreateProductForm from '../components/forms/CreateProductForm'
import AddPrimaryStockForm from '../components/forms/AddPrimaryStockForm'
import AddFinishedStockForm from '../components/forms/AddFinishedStockForm'
import MoveStockForm from '../components/forms/MoveStockForm'
import CreateColorForm from '../components/forms/CreateColorForm'
import CreateMaterialCatalogForm from '../components/forms/CreateMaterialCatalogForm'

export default function Almacen(){
  const me = getUserFromToken()
  const puedeVer = hasRole(me, 'ALMACENERO') || hasRole(me,'PRODUCCION') || hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR')
  if (!puedeVer) return <section className="card">No tienes permiso.</section>

  // modales
  const [open, setOpen] = useState({
    addMP:false, addPT:false, createMP:false, createPT:false, move:false, color:false, material:false
  })

  const closeAll = () => setOpen({
    addMP:false, addPT:false, createMP:false, createPT:false, move:false, color:false, material:false
  })

  return (
    <section className="card">
      <div className="topbar" style={{marginBottom:8}}>
        <div>
          <h3 style={{margin:0}}>Almacén</h3>
          <div className="muted">Gestión de zonas e inventario</div>
        </div>
        <div style={{display:'flex',gap:8, flexWrap:'wrap'}}>
          <button className="btn" onClick={()=>setOpen(o=>({...o, addMP:true}))}>➕ Agregar Materia Prima</button>
          <button className="btn" onClick={()=>setOpen(o=>({...o, addPT:true}))}>🧱 Agregar Producto Terminado</button>
          <button className="btn-secondary" onClick={()=>setOpen(o=>({...o, createMP:true}))}>✚ Crear Materia Prima</button>
          <button className="btn-secondary" onClick={()=>setOpen(o=>({...o, createPT:true}))}>✚ Crear Producto Terminado</button>
          <button className="btn" onClick={()=>setOpen(o=>({...o, move:true}))}>📦 Mover entre zonas</button>
          <button className="btn-secondary" onClick={()=>setOpen(o=>({...o, color:true}))}>🎨 Extras: Crear Color</button>
          <button className="btn-secondary" onClick={()=>setOpen(o=>({...o, material:true}))}>🧪 Extras: Crear Material</button>
        </div>
      </div>

      {/* Aquí puedes poner tus KPIs y tabla de inventario, de momento lo dejamos como placeholder */}
      <div className="grid-3" style={{marginTop:12}}>
        <div className="stat"><div className="stat__label">Recepción</div><div className="stat__value">—</div></div>
        <div className="stat"><div className="stat__label">Almacén</div><div className="stat__value">—</div></div>
        <div className="stat"><div className="stat__label">Merma</div><div className="stat__value">—</div></div>
      </div>

      {/* MODALES */}
      <Modal open={open.addMP} title="Agregar Materia Prima" onClose={closeAll}>
        <AddPrimaryStockForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.addPT} title="Agregar Producto Terminado" onClose={closeAll}>
        <AddFinishedStockForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.createMP} title="Crear Materia Prima" onClose={closeAll} maxWidth={720}>
        <CreatePrimaryMaterialForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.createPT} title="Crear Producto Terminado" onClose={closeAll} maxWidth={820}>
        <CreateProductForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.move} title="Mover entre zonas" onClose={closeAll}>
        <MoveStockForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.color} title="Crear Color" onClose={closeAll}>
        <CreateColorForm onDone={closeAll}/>
      </Modal>

      <Modal open={open.material} title="Crear Material" onClose={closeAll}>
        <CreateMaterialCatalogForm onDone={closeAll}/>
      </Modal>
    </section>
  )
}
