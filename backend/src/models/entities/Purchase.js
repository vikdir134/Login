export default class Purchase {
  constructor({
    id, supplierId, documentType, documentNumber, documentDate,
    totalNet, taxAmount, totalAmount, currency = 'PEN', notes,
    createdBy, createdAt
  }) {
    this.id = id
    this.supplierId = supplierId
    this.documentType = documentType
    this.documentNumber = documentNumber
    this.documentDate = documentDate
    this.totalNet = Number(totalNet ?? 0)
    this.taxAmount = Number(taxAmount ?? 0)
    this.totalAmount = Number(totalAmount ?? 0)
    this.currency = currency
    this.notes = notes
    this.createdBy = createdBy
    this.createdAt = createdAt ?? new Date()
  }
}
