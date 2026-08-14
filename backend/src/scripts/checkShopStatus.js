// Simple test to check if sellers have isShopOpen field
db.sellers.find({}, { storeName: 1, isShopOpen: 1, _id: 0 }).limit(10)

// Update all sellers to have isShopOpen field if missing
db.sellers.updateMany(
  { isShopOpen: { $exists: false } },
  { $set: { isShopOpen: true } }
)

// Verify the update
db.sellers.find({ isShopOpen: { $exists: false } }).count()
