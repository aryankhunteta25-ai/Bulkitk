require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');
const Shop = require('../models/Shop');

const products = [
  {
    name: 'Tata Salt 1kg',
    brand: 'Tata',
    category: 'grocery_staples',
    packUnit: 'carton',
    packSize: '24 packs of 1kg',
    pricePerPack: 575,
    slabs: [
      { minQty: 5, discountPercent: 3 },
      { minQty: 10, discountPercent: 6, freeDelivery: true },
    ],
    stockAvailable: 500,
  },
  {
    name: 'Aashirvaad Atta 5kg',
    brand: 'Aashirvaad',
    category: 'grocery_staples',
    packUnit: 'sack',
    packSize: '10 bags of 5kg',
    pricePerPack: 2270,
    slabs: [{ minQty: 3, discountPercent: 4 }],
    stockAvailable: 300,
  },
  {
    name: 'Dettol Handwash 200ml',
    brand: 'Dettol',
    category: 'personal_care',
    packUnit: 'box',
    packSize: '12 bottles',
    pricePerPack: 909,
    slabs: [{ minQty: 6, discountPercent: 5 }],
    stockAvailable: 200,
  },
  {
    name: 'Parle-G Biscuits',
    brand: 'Parle',
    category: 'snacks_biscuits',
    packUnit: 'case',
    packSize: '96 packs',
    pricePerPack: 989,
    slabs: [{ minQty: 2, discountPercent: 3 }],
    stockAvailable: 400,
  },
  {
    name: 'Fortune Sunflower Oil 15L',
    brand: 'Fortune',
    category: 'grocery_staples',
    packUnit: 'tin',
    packSize: '1 tin of 15L',
    pricePerPack: 2140,
    slabs: [{ minQty: 4, discountPercent: 4, freeDelivery: true }],
    stockAvailable: 150,
  },
];

async function seed() {
  await connectDB();

  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log(`Seeded ${products.length} products.`);

  const existingShop = await Shop.findOne({ phone: '9999900000' });
  if (!existingShop) {
    const passwordHash = await Shop.hashPassword('password123');
    await Shop.create({
      shopName: 'Rajesh Kirana Store',
      ownerName: 'Rajesh Sharma',
      phone: '9999900000',
      email: 'rajesh@example.com',
      passwordHash,
      gstin: '08AACR1234A1Z5',
      creditLimit: 61500,
      creditUsed: 23300,
      crateCoins: 2480,
      tier: 'silver',
      monthlyOrderValue: 41600,
    });
    console.log('Seeded demo shop: phone 9999900000 / password password123');
  }

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
