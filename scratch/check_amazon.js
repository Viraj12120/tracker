const db = require('knex')({ client: 'sqlite3', connection: { filename: './data/billing.db' }, useNullAsDefault: true });
db('bills').where('company', 'AMAZON').andWhere('status', '!=', 'deleted').select('id', 'po_number', 'total_amount').then(async bills => {
  for (const b of bills) {
    const items = await db('bill_items').where('bill_id', b.id).select('description', 'qty', 'unit_price', 'total_amount');
    for (const it of items) {
      let calc = it.qty * it.unit_price;
      if (Math.abs(calc - it.total_amount) > 0.01) {
        console.log(`Mismatch on Bill ${b.id} PO ${b.po_number}: Qty ${it.qty} * Price ${it.unit_price} = ${calc}, but DB total_amount is ${it.total_amount}`);
      }
    }
  }
  process.exit();
});
