const Product  = require('../products/product.model');
const Customer = require('../customers/customer.model');

const DEMO_PRODUCTS = [
  {
    name: 'Classic White Sneakers', category: 'Footwear', subCategory: 'Unisex',
    price: 1299, costPrice: 750, discount: 5, stock: 48, unit: 'pair',
    sizes: ['6', '7', '8', '9', '10', '11'],
    colors: [{ name: 'White', hex: '#f9fafb' }, { name: 'Black', hex: '#111827' }],
    description: 'Comfortable everyday sneakers with cushioned sole.',
    isFeatured: true, isNewArrival: true,
    isDemo: true,
  },
  {
    name: 'Men\'s Slim Fit T-Shirt', category: 'Clothing', subCategory: 'Mens',
    price: 599, costPrice: 220, discount: 0, stock: 120, unit: 'pcs',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Navy', hex: '#1e3a5f' }, { name: 'White', hex: '#f9fafb' },
      { name: 'Black', hex: '#111827' },
    ],
    description: 'Premium cotton slim-fit t-shirt for everyday wear.',
    isTrending: true,
    isDemo: true,
  },
  {
    name: 'Denim Straight Jeans', category: 'Clothing', subCategory: 'Mens',
    price: 1499, costPrice: 700, discount: 10, stock: 35, unit: 'pcs',
    sizes: ['28', '30', '32', '34', '36'],
    colors: [{ name: 'Blue', hex: '#3b82f6' }, { name: 'Black', hex: '#111827' }],
    description: 'Classic straight-fit denim with stretch comfort.',
    isDemo: true,
  },
  {
    name: 'Women\'s Floral Kurta', category: 'Clothing', subCategory: 'Womens',
    price: 849, costPrice: 380, discount: 0, stock: 60, unit: 'pcs',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [{ name: 'Pink', hex: '#ec4899' }, { name: 'Yellow', hex: '#eab308' }],
    description: 'Elegant floral print kurta in soft cotton fabric.',
    isFeatured: true,
    isDemo: true,
  },
  {
    name: 'Sports Bottle 1L', category: 'Accessories', subCategory: 'Unisex',
    price: 349, costPrice: 140, discount: 0, stock: 200, unit: 'pcs',
    colors: [{ name: 'Blue', hex: '#3b82f6' }, { name: 'Green', hex: '#22c55e' }],
    description: 'BPA-free leak-proof sports bottle for gym and travel.',
    isDemo: true,
  },
];

const DEMO_CUSTOMERS = [
  { name: 'Vicky Sharma',  phone: '9876543210', email: 'vicky@demo.com',  city: 'Mumbai',    isDemo: true },
  { name: 'Rahul Verma',   phone: '9876543211', email: 'rahul@demo.com',  city: 'Delhi',     isDemo: true },
  { name: 'Priya Singh',   phone: '9876543212', email: 'priya@demo.com',  city: 'Bangalore', isDemo: true },
  { name: 'Amit Patel',    phone: '9876543213', email: 'amit@demo.com',   city: 'Surat',     isDemo: true },
  { name: 'Sneha Gupta',   phone: '9876543214', email: 'sneha@demo.com',  city: 'Pune',      isDemo: true },
];

const seedDemo = async (shopId, ownerId) => {
  // Remove any previous demo data for this shop
  await Promise.all([
    Product.deleteMany({ shopId, isDemo: true }),
    Customer.deleteMany({ shopId, isDemo: true }),
  ]);

  const products = await Product.insertMany(
    DEMO_PRODUCTS.map((p) => ({ ...p, shopId, ownerId }))
  );

  const customers = await Customer.insertMany(
    DEMO_CUSTOMERS.map((c) => ({ ...c, shopId, ownerId }))
  );

  return { products: products.length, customers: customers.length };
};

const clearDemo = async (shopId) => {
  const [p, c] = await Promise.all([
    Product.deleteMany({ shopId, isDemo: true }),
    Customer.deleteMany({ shopId, isDemo: true }),
  ]);
  return { productsRemoved: p.deletedCount, customersRemoved: c.deletedCount };
};

module.exports = { seedDemo, clearDemo };
