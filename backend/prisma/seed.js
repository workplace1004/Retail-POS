import { PrismaClient } from '@prisma/client';
import { hashWebpanelPassword } from '../lib/webpanelAuth.js';

const prisma = new PrismaClient();

/** Default webpanel login (change password in production). */
const SEED_WEBPANEL_EMAIL = 'retail@pos.com';
const SEED_WEBPANEL_PASSWORD = '123123';

function createSeededRng(seed = 20260428) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rand = createSeededRng();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randomInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const money = (n) => Math.round(n * 100) / 100;
const UNITS = ['Piece', 'Kg', 'Liter', 'Meter'];

function randomDateBetween(from, to) {
  const ms = from.getTime() + rand() * (to.getTime() - from.getTime());
  return new Date(ms);
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.orderPayment.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.webpanelLabelQueueItem.deleteMany();
    await tx.product.deleteMany();
    await tx.category.deleteMany();
    await tx.subproduct.deleteMany();
    await tx.subproductGroup.deleteMany();
    await tx.customer.deleteMany();
    await tx.posRegisterUser.deleteMany();
    await tx.posRegister.deleteMany();
    await tx.webpanelUser.deleteMany();
    await tx.user.deleteMany();
    await tx.discount.deleteMany();
    await tx.productionMessage.deleteMany();
    await tx.printerLabel.deleteMany();
    await tx.paymentMethod.deleteMany();
    await tx.paymentTerminal.deleteMany();
    await tx.printer.deleteMany();
    await tx.appSetting.deleteMany();
    await tx.priceGroup.deleteMany();
    await tx.supplier.deleteMany();
  });

  const users = await Promise.all([
    prisma.user.create({ data: { id: 'admin', name: 'Admin', role: 'admin', pin: '1234' } }),
    prisma.user.create({ data: { name: 'Alice', role: 'waiter', pin: '1111' } }),
    prisma.user.create({ data: { name: 'Bob', role: 'waiter', pin: '2222' } }),
    prisma.user.create({ data: { name: 'Charlie', role: 'waiter', pin: '3333' } }),
  ]);

  await prisma.webpanelUser.create({
    data: {
      email: SEED_WEBPANEL_EMAIL,
      passwordHash: hashWebpanelPassword(SEED_WEBPANEL_PASSWORD),
      name: 'Retail webpanel',
    },
  });

  const registers = await Promise.all([
    prisma.posRegister.create({ data: { name: 'pos1', ipAddress: '192.168.1.1' } }),
    prisma.posRegister.create({ data: { name: 'pos2', ipAddress: '192.168.1.2' } }),
  ]);
  await prisma.posRegisterUser.createMany({
    data: users.flatMap((u, i) => [{ registerId: registers[i % registers.length].id, userId: u.id }]),
  });

  const paymentMethods = await Promise.all([
    prisma.paymentMethod.create({ data: { name: 'Cash', integration: 'manual_cash', active: true, sortOrder: 0 } }),
    prisma.paymentMethod.create({ data: { name: 'Cashmatic', integration: 'cashmatic', active: true, sortOrder: 1 } }),
    prisma.paymentMethod.create({ data: { name: 'Card (Payworld)', integration: 'payworld', active: true, sortOrder: 2 } }),
    prisma.paymentMethod.create({ data: { name: 'Bancontact', integration: 'generic', active: true, sortOrder: 3 } }),
  ]);

  const priceGroups = await Promise.all([
    prisma.priceGroup.create({ data: { name: 'Standard', tax: 'standard', sortOrder: 0 } }),
    prisma.priceGroup.create({ data: { name: 'Take-out', tax: 'reduced', sortOrder: 1 } }),
    prisma.priceGroup.create({ data: { name: 'Eat-in', tax: 'standard', sortOrder: 2 } }),
  ]);

  const suppliers = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      prisma.supplier.create({
        data: {
          companyName: `Supplier ${i + 1}`,
          vatNumber: `BE0${randomInt(100000000, 999999999)}`,
          street: `Street ${i + 1}`,
          postalCode: `${randomInt(1000, 9999)}`,
          city: 'Brussels',
          country: 'BE',
          phone: `+3247${randomInt(1000000, 9999999)}`,
          email: `supplier${i + 1}@demo.local`,
          remarks: 'Seeded supplier',
        },
      }),
    ),
  );

  const categoryNames = ['Drinks', 'Food', 'Desserts', 'Starters', 'Mains', 'Snacks', 'Other', 'Seasonal'];
  const categories = await Promise.all(
    categoryNames.map((name, i) =>
      prisma.category.create({
        data: {
          name,
          sortOrder: i,
          inWebshop: true,
          displayOnCashRegister: true,
          nextCourse: i % 3 === 0 ? 'next' : null,
        },
      }),
    ),
  );

  const subproductGroups = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.subproductGroup.create({
        data: { name: `Options group ${i + 1}`, sortOrder: i },
      }),
    ),
  );

  await prisma.subproduct.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({
      name: `Subproduct ${i + 1}`,
      groupId: subproductGroups[i % subproductGroups.length].id,
      sortOrder: i % 8,
      price: money(randomInt(0, 350) / 100),
      keyName: `SP${String(i + 1).padStart(3, '0')}`,
      vatTakeOut: ['6', '12', '21'][i % 3],
    })),
  });

  const productPrefixes = [
    'Coffee', 'Tea', 'Juice', 'Water', 'Soda', 'Burger', 'Pizza', 'Pasta', 'Salad', 'Soup',
    'Wrap', 'Sandwich', 'Cake', 'Cookie', 'Ice Cream', 'Steak', 'Fries', 'Rice Bowl', 'Taco', 'Nachos',
  ];

  const productsData = Array.from({ length: 100 }, (_, i) => {
    const category = categories[i % categories.length];
    const prefix = productPrefixes[i % productPrefixes.length];
    const name = `${prefix} ${i + 1}`;
    const price = money(randomInt(190, 3590) / 100);
    const purchaseExcl = money(price * (0.45 + rand() * 0.25));
    const purchaseIncl = money(purchaseExcl * 1.21);
    const unit = i % 7 === 0 ? pick(UNITS.filter((u) => u !== 'Piece')) : 'Piece';
    const measured = unit !== 'Piece';
    const stockQty = measured ? money(randomInt(2, 250) / 10) : randomInt(0, 120);
    const barcode = `${randomInt(100000000000, 999999999999)}`;
    const extraPrices = [
      { priceGroupId: priceGroups[1].id, priceGroupLabel: priceGroups[1].name, otherName: `${name} TO`, otherPrinter: '', otherPrice: money(price * 0.95) },
      { priceGroupId: priceGroups[2].id, priceGroupLabel: priceGroups[2].name, otherName: `${name} EI`, otherPrinter: '', otherPrice: money(price * 1.05) },
    ];
    return {
      number: 1000 + i,
      name,
      price,
      categoryId: category.id,
      sortOrder: i,
      keyName: `${prefix.slice(0, 4).toUpperCase()}${i + 1}`,
      productionName: `${name} prod`,
      vatTakeOut: ['6', '12', '21'][i % 3],
      barcode,
      printer1: i % 3 === 0 ? 'Main printer' : null,
      printer2: i % 5 === 0 ? 'Kitchen printer' : null,
      printer3: null,
      addition: subproductGroups[i % subproductGroups.length].id,
      categoryIdsJson: JSON.stringify([category.id]),
      openPrice: i % 17 === 0,
      weegschaal: measured,
      subproductRequires: i % 7 === 0,
      leeggoedPrijs: i % 15 === 0 ? `${money(randomInt(10, 80) / 100)}` : null,
      pagerVerplicht: i % 11 === 0,
      boldPrint: i % 8 === 0,
      groupingReceipt: i % 10 !== 0,
      labelExtraInfo: i % 6 === 0 ? `Lot-${1000 + i}` : null,
      kassaPhotoPath: null,
      voorverpakVervaltype: i % 14 === 0 ? 'days' : null,
      houdbareDagen: i % 14 === 0 ? `${randomInt(2, 14)}` : null,
      bewarenGebruik: i % 14 === 0 ? 'Cool and dry' : null,
      extraPricesJson: JSON.stringify(extraPrices),
      purchaseVat: '21',
      purchasePriceExcl: `${purchaseExcl}`,
      purchasePriceIncl: `${purchaseIncl}`,
      profitPct: `${money(((price - purchaseExcl) / Math.max(0.01, purchaseExcl)) * 100)}`,
      unit,
      unitContent: measured ? `${money(randomInt(25, 150) / 100)}` : '1',
      stock: `${stockQty}`,
      supplierId: suppliers[i % suppliers.length].id,
      supplierCode: `SUP-${i + 1}`,
      stockNotification: i % 4 !== 0,
      expirationDate: i % 13 === 0 ? `2026-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}` : null,
      declarationExpiryDays: i % 13 === 0 ? `${randomInt(5, 30)}` : null,
      notificationSoldOutPieces: `${randomInt(1, 10)}`,
      inWebshop: i % 5 !== 0,
      onlineOrderable: i % 9 !== 0,
      websiteRemark: i % 6 === 0 ? 'Seed remark' : null,
      websiteOrder: `${i + 1}`,
      shortWebText: `${name} short text`,
      websitePhotoPath: null,
      kioskInfo: i % 4 === 0 ? 'Contains allergens' : null,
      kioskTakeAway: i % 3 !== 0,
      kioskEatIn: i % 3 === 0 ? 'true' : 'false',
      kioskSubtitle: i % 6 === 0 ? 'Popular choice' : null,
      kioskMinSubs: `${i % 2}`,
      kioskMaxSubs: `${randomInt(1, 4)}`,
      kioskPicturePath: null,
    };
  });

  await prisma.product.createMany({ data: productsData });
  const products = await prisma.product.findMany({ orderBy: { number: 'asc' } });

  const customers = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      prisma.customer.create({
        data: {
          companyName: i % 3 === 0 ? `Company ${i + 1}` : null,
          firstName: `First${i + 1}`,
          lastName: `Last${i + 1}`,
          name: `Customer ${i + 1}`,
          street: `Main street ${i + 1}`,
          postalCode: `${randomInt(1000, 9999)}`,
          city: 'Brussels',
          country: 'BE',
          phone: `+3247${randomInt(1000000, 9999999)}`,
          email: `customer${i + 1}@demo.local`,
          discount: i % 4 === 0 ? '5' : null,
          priceGroup: priceGroups[i % priceGroups.length].name,
          vatNumber: i % 5 === 0 ? `BE0${randomInt(100000000, 999999999)}` : null,
          loyaltyCardBarcode: i % 2 === 0 ? `${randomInt(100000000000, 999999999999)}` : null,
          creditTag: i % 6 === 0 ? 'vip' : null,
        },
      }),
    ),
  );

  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  from.setHours(0, 0, 0, 0);
  const serviceTypes = ['eat_in', 'take_out', null];

  for (let i = 0; i < 70; i += 1) {
    const orderDate = randomDateBetween(from, now);
    const itemCount = randomInt(1, 6);
    const itemData = [];
    let total = 0;
    for (let j = 0; j < itemCount; j += 1) {
      const product = pick(products);
      const qty = product.weegschaal ? 1 : randomInt(1, 3);
      const linePrice = money((Number(product.price) || 0) * qty);
      total += linePrice;
      const noteParts = [];
      if (rand() > 0.65) {
        noteParts.push(`subproducts:${pick(['Small', 'Large', 'Spicy', 'No onion'])}`);
      }
      if (rand() > 0.8) noteParts.push('No salt');
      itemData.push({
        productId: product.id,
        quantity: qty,
        price: Number(product.price) || 0,
        notes: noteParts.length ? noteParts.join(' | ') : null,
        ticketStrikeJson: null,
      });
    }
    total = money(total);
    const order = await prisma.order.create({
      data: {
        posRegisterId: pick(registers).id,
        customerId: rand() > 0.25 ? pick(customers).id : null,
        userId: pick(users).id,
        status: 'paid',
        total,
        kioskServiceType: pick(serviceTypes),
        source: rand() > 0.85 ? 'weborder' : 'pos',
        printed: true,
        itemBatchBoundariesJson: null,
        itemBatchMetaJson: null,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });

    await prisma.orderItem.createMany({
      data: itemData.map((it) => ({ ...it, orderId: order.id })),
    });

    if (rand() > 0.72) {
      const split1 = money(total * (0.2 + rand() * 0.6));
      const split2 = money(total - split1);
      await prisma.orderPayment.createMany({
        data: [
          { orderId: order.id, paymentMethodId: paymentMethods[0].id, amount: split1, createdAt: orderDate },
          { orderId: order.id, paymentMethodId: paymentMethods[3].id, amount: split2, createdAt: orderDate },
        ],
      });
    } else {
      await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          paymentMethodId: pick(paymentMethods).id,
          amount: total,
          createdAt: orderDate,
        },
      });
    }
  }

  console.log(
    [
      `Seed done (webpanel: ${SEED_WEBPANEL_EMAIL} / ${SEED_WEBPANEL_PASSWORD}).`,
      `Products: 100`,
      `Subproduct groups: 10`,
      `Subproducts: 40`,
      `Paid order history: 70 (last month -> today)`,
    ].join(' ')
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
