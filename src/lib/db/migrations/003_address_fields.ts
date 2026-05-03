import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bills', (table) => {
    // Address fields (AMAZON: billing/shipping; STAR: vendor supply address)
    table.text('billing_address');
    table.text('shipping_address');
    table.text('vendor_address');   // STAR "Vendor Supply Address"

    // STAR header extras
    table.string('plant_description');  // Receiving Plant description e.g. "Satara CC, Satara"
    table.string('company_pan');        // Company PAN
    table.string('gstn');               // GSTN/UIN
    table.string('movement_type');      // Movement Type e.g. 101
    table.string('currency');           // AMAZON currency field
    table.string('challan_version');    // AMAZON challan version
  });

  await knex.schema.alterTable('bill_items', (table) => {
    table.float('po_qty');      // STAR: PO Qty column
    table.string('ean');        // STAR: EAN barcode
    table.string('merch_cat'); // STAR: Merchandise Category
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bills', (table) => {
    table.dropColumn('billing_address');
    table.dropColumn('shipping_address');
    table.dropColumn('vendor_address');
    table.dropColumn('plant_description');
    table.dropColumn('company_pan');
    table.dropColumn('gstn');
    table.dropColumn('movement_type');
    table.dropColumn('currency');
    table.dropColumn('challan_version');
  });

  await knex.schema.alterTable('bill_items', (table) => {
    table.dropColumn('po_qty');
    table.dropColumn('ean');
    table.dropColumn('merch_cat');
  });
}
