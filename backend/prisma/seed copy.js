import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ─── USERS (POS login) ─────────────────────────────────────────────────
  const userData = [
    { id: 'user-1', name: 'User 1', role: 'waiter', pin: '1234' },
    { id: 'user-2', name: 'User 2', role: 'waiter', pin: '1234' },
    { id: 'user-3', name: 'User 3', role: 'waiter', pin: '1234' }
  ];
  for (const u of userData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u
    });
  }

  // ─── CATEGORIES ─────────────────────────────────────────────────────────
  const catDrinks = await prisma.category.upsert({
    where: { id: 'cat-drinks' },
    update: {},
    create: { id: 'cat-drinks', name: 'DRINKS', sortOrder: 1 }
  });
  const catAppetizer = await prisma.category.upsert({
    where: { id: 'cat-appetizer' },
    update: {},
    create: { id: 'cat-appetizer', name: 'APPETIZER', sortOrder: 2 }
  });
  const catTapas = await prisma.category.upsert({
    where: { id: 'cat-tapas' },
    update: {},
    create: { id: 'cat-tapas', name: 'TAPAS', sortOrder: 3 }
  });
  const catMain = await prisma.category.upsert({
    where: { id: 'cat-main' },
    update: {},
    create: { id: 'cat-main', name: 'MAIN COURSE', sortOrder: 4 }
  });
  const catDesserts = await prisma.category.upsert({
    where: { id: 'cat-desserts' },
    update: {},
    create: { id: 'cat-desserts', name: 'DESSERTS', sortOrder: 5 }
  });
  const catKids = await prisma.category.upsert({
    where: { id: 'cat-kids' },
    update: {},
    create: { id: 'cat-kids', name: 'KIDS', sortOrder: 6 }
  });

  // ─── TABLES ────────────────────────────────────────────────────────────
  const tableData = [
    { id: 'table-1', name: 'Table 1', status: 'available' },
    { id: 'table-2', name: 'Table 2', status: 'available' },
    { id: 'table-3', name: 'Table 3', status: 'available' },
    { id: 'table-4', name: 'Table 4', status: 'available' },
    { id: 'table-5', name: 'Table 5', status: 'available' },
    { id: 'table-6', name: 'Table 6', status: 'available' },
    { id: 'table-7', name: 'Table 7', status: 'available' },
    { id: 'table-8', name: 'Table 8', status: 'available' }
  ];
  for (const t of tableData) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: {},
      create: t
    });
  }

  // ─── SUBPRODUCT GROUPS ──────────────────────────────────────────────────
  const groupToppings = await prisma.subproductGroup.upsert({
    where: { id: 'spg-toppings' },
    update: {},
    create: { id: 'spg-toppings', name: 'Toppings', sortOrder: 0 }
  });
  const groupOptions = await prisma.subproductGroup.upsert({
    where: { id: 'spg-options' },
    update: {},
    create: { id: 'spg-options', name: 'Options', sortOrder: 1 }
  });

  // ─── SUBPRODUCTS (per group, each with its own price) ─────────────────────
  const subproductData = [
    { id: 'sp-toppings-extra-cheese', name: 'Extra cheese', groupId: groupToppings.id, sortOrder: 0, price: 0.5 },
    { id: 'sp-toppings-no-onion', name: 'No onion', groupId: groupToppings.id, sortOrder: 1, price: 0 },
    { id: 'sp-toppings-gluten-free', name: 'Gluten-free', groupId: groupToppings.id, sortOrder: 2, price: 0.3 },
    { id: 'sp-options-small', name: 'Small', groupId: groupOptions.id, sortOrder: 0, price: 1.5 },
    { id: 'sp-options-medium', name: 'Medium', groupId: groupOptions.id, sortOrder: 1, price: 2.0 },
    { id: 'sp-options-large', name: 'Large', groupId: groupOptions.id, sortOrder: 2, price: 2.5 }
  ];
  for (const sp of subproductData) {
    const { price, ...rest } = sp;
    await prisma.subproduct.upsert({
      where: { id: sp.id },
      update: { price: price ?? undefined },
      create: { ...rest, price: price ?? undefined }
    });
  }

  // ─── PRODUCTS (every product has addition = SubproductGroup name → subproducts when clicked) ───
  const productData = [
    { id: 'prod-cola', categoryId: catDrinks.id, name: 'Cola', price: 2.5, number: 1, sortOrder: 0, addition: groupOptions.name, subproductRequires: false },
    { id: 'prod-water', categoryId: catDrinks.id, name: 'Water', price: 1.5, number: 2, sortOrder: 1, addition: groupOptions.name, subproductRequires: false },
    { id: 'prod-coffee', categoryId: catDrinks.id, name: 'Coffee', price: 2.8, number: 3, sortOrder: 2, addition: groupOptions.name, subproductRequires: false },
    { id: 'prod-soup', categoryId: catAppetizer.id, name: 'Soup', price: 4.5, number: 4, sortOrder: 3, addition: groupToppings.name, subproductRequires: false },
    { id: 'prod-salad', categoryId: catAppetizer.id, name: 'Salad', price: 5.0, number: 5, sortOrder: 4, addition: groupToppings.name, subproductRequires: false },
    { id: 'prod-olives', categoryId: catTapas.id, name: 'Olives', price: 3.5, number: 6, sortOrder: 5, addition: groupToppings.name, subproductRequires: false },
    { id: 'prod-bread', categoryId: catTapas.id, name: 'Bread', price: 2.0, number: 7, sortOrder: 6, addition: groupToppings.name, subproductRequires: false },
    { id: 'prod-steak', categoryId: catMain.id, name: 'Steak', price: 18.0, number: 8, sortOrder: 7, addition: groupToppings.name, subproductRequires: false },
    { id: 'prod-pasta', categoryId: catMain.id, name: 'Pasta', price: 12.0, number: 9, sortOrder: 8, addition: groupToppings.name, subproductRequires: true },
    { id: 'prod-ice-cream', categoryId: catDesserts.id, name: 'Ice Cream', price: 5.0, number: 10, sortOrder: 9, addition: groupOptions.name, subproductRequires: false },
    { id: 'prod-kids-menu', categoryId: catKids.id, name: 'Kids Menu', price: 8.0, number: 11, sortOrder: 10, addition: groupOptions.name, subproductRequires: false }
  ];
  for (const p of productData) {
    const { addition, subproductRequires, ...rest } = p;
    const additionValue = addition ?? null;
    const subproductRequiresValue = subproductRequires ?? false;
    await prisma.product.upsert({
      where: { id: p.id },
      update: { addition: additionValue, subproductRequires: subproductRequiresValue },
      create: {
        ...rest,
        addition: additionValue,
        subproductRequires: subproductRequiresValue
      }
    });
  }

  // ─── CUSTOMERS (only if empty) ──────────────────────────────────────────
  const existingCustomers = await prisma.customer.count();
  if (existingCustomers === 0) {
    await prisma.customer.createMany({
      data: [
        { companyName: 'pospoint', name: 'pospoint', street: 'Mezenstraat', phone: null },
        { companyName: 'TestCustomer', name: 'TestCustomer', street: 'Street NoTest.', phone: '123456789' }
      ]
    });
  }

  // ─── KITCHENS (KDS admin: login name "admin", PIN 1234) ───────────────────
  await prisma.kitchen.upsert({
    where: { id: 'kitchen-kds-admin' },
    update: { name: 'admin', pin: '1234' },
    create: { id: 'kitchen-kds-admin', name: 'admin', pin: '1234' }
  });

  // ─── DISCOUNTS ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const discountData = [
    { id: 'disc-10pct', name: '10% off', trigger: 'number', type: 'percent', value: '10', startDate: today, endDate: today, discountOn: 'products', pieces: '', combinable: false },
    { id: 'disc-happy-hour', name: 'Happy hour', trigger: 'number', type: 'amount', value: '2', startDate: today, endDate: today, discountOn: 'products', pieces: '', combinable: false },
    { id: 'disc-student', name: 'Student discount', trigger: 'number', type: 'percent', value: '15', startDate: today, endDate: today, discountOn: 'products', pieces: '', combinable: false }
  ];
  for (const d of discountData) {
    await prisma.discount.upsert({
      where: { id: d.id },
      update: { name: d.name, value: d.value, type: d.type },
      create: d
    });
  }

  // ─── ORDERS (sample orders with items) ───────────────────────────────────
  const order1 = await prisma.order.upsert({
    where: { id: 'order-1' },
    update: {},
    create: {
      id: 'order-1',
      tableId: 'table-1',
      status: 'open',
      total: 9.5,
      source: 'pos'
    }
  });
  const order1Items = [
    { id: 'oi-1-1', orderId: order1.id, productId: 'prod-cola', quantity: 2, price: 2.5, notes: null },
    { id: 'oi-1-2', orderId: order1.id, productId: 'prod-water', quantity: 1, price: 1.5, notes: null }
  ];
  for (const oi of order1Items) {
    await prisma.orderItem.upsert({
      where: { id: oi.id },
      update: { quantity: oi.quantity, price: oi.price },
      create: oi
    });
  }

  const order2 = await prisma.order.upsert({
    where: { id: 'order-2' },
    update: {},
    create: {
      id: 'order-2',
      tableId: 'table-2',
      status: 'open',
      total: 35.0,
      source: 'pos'
    }
  });
  const order2Items = [
    { id: 'oi-2-1', orderId: order2.id, productId: 'prod-steak', quantity: 1, price: 18.0, notes: 'Well done' },
    { id: 'oi-2-2', orderId: order2.id, productId: 'prod-pasta', quantity: 1, price: 12.0, notes: null },
    { id: 'oi-2-3', orderId: order2.id, productId: 'prod-coffee', quantity: 1, price: 2.8, notes: null },
    { id: 'oi-2-4', orderId: order2.id, productId: 'prod-ice-cream', quantity: 1, price: 5.0, notes: null }
  ];
  for (const oi of order2Items) {
    await prisma.orderItem.upsert({
      where: { id: oi.id },
      update: { quantity: oi.quantity, price: oi.price, notes: oi.notes },
      create: oi
    });
  }

  const order3 = await prisma.order.upsert({
    where: { id: 'order-3' },
    update: {},
    create: {
      id: 'order-3',
      tableId: 'table-3',
      status: 'paid',
      total: 14.0,
      source: 'pos'
    }
  });
  const order3Items = [
    { id: 'oi-3-1', orderId: order3.id, productId: 'prod-soup', quantity: 1, price: 4.5, notes: null },
    { id: 'oi-3-2', orderId: order3.id, productId: 'prod-salad', quantity: 1, price: 5.0, notes: 'No onions' },
    { id: 'oi-3-3', orderId: order3.id, productId: 'prod-bread', quantity: 2, price: 2.0, notes: null }
  ];
  for (const oi of order3Items) {
    await prisma.orderItem.upsert({
      where: { id: oi.id },
      update: { quantity: oi.quantity, price: oi.price, notes: oi.notes },
      create: oi
    });
  }

  // Mark tables with open orders as occupied
  await prisma.table.updateMany({
    where: { id: { in: ['table-1', 'table-2'] } },
    data: { status: 'occupied' }
  });

  console.log('Seed done: users, categories, tables, subproduct groups, subproducts, products, customers, kitchens, discounts, orders.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
