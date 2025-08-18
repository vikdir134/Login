export default class PurchaseItem {
  constructor({ id, purchaseId, primaterId, quantity, unitPrice, totalPrice, notes }) {
    this.id = id
    this.purchaseId = purchaseId
    this.primaterId = primaterId
    this.quantity = Number(quantity)
    this.unitPrice = Number(unitPrice)
    this.totalPrice = Number(totalPrice ?? (this.quantity * this.unitPrice))
    this.notes = notes
  }
}
