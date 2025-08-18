export default class Supplier {
  constructor({ id, name, ruc, address, phone, email, contactPerson, active = 1, createdAt }) {
    this.id = id
    this.name = name
    this.ruc = ruc
    this.address = address
    this.phone = phone
    this.email = email
    this.contactPerson = contactPerson
    this.active = !!active
    this.createdAt = createdAt ?? new Date()
  }
}
