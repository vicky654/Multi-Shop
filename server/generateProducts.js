const fs = require("fs");

const categories = [
  "Fruits",
  "Dairy",
  "Bakery",
  "Snacks",
  "Beverages",
  "Grocery",
  "Personal Care",
];

const productNames = [
  "Apple", "Banana", "Milk", "Bread", "Eggs", "Rice", "Sugar",
  "Salt", "Oil", "Soap", "Shampoo", "Toothpaste", "Juice",
  "Biscuits", "Chips", "Chocolate", "Butter", "Cheese"
];

let csv = "name,price,costPrice,category,stock,barcode,image\n";

for (let i = 1; i <= 1000; i++) {
  const name = productNames[Math.floor(Math.random() * productNames.length)] + " " + i;
  const price = Math.floor(Math.random() * 200) + 20;
  const costPrice = price - Math.floor(Math.random() * 20);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const stock = Math.floor(Math.random() * 200);
  const barcode = 300000 + i;
  const image = `https://source.unsplash.com/300x300/?${name.split(" ")[0]}`;

  csv += `${name},${price},${costPrice},${category},${stock},${barcode},${image}\n`;
}

fs.writeFileSync("products_1000.csv", csv);
console.log("✅ CSV Generated: products_1000.csv");