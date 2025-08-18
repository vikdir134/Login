// backend/src/models/entities/Customer.js
export default class Customer {
  constructor({ id, ruc, razonSocial, activo = true, createdAt = new Date() }) {
    this.id = id
    this.ruc = ruc
    this.razonSocial = razonSocial
    this.activo = Boolean(activo)
    this.createdAt = createdAt
  }
}
