import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('bills', (table) => {
    table.increments('id').primary();
    table.string('company').notNullable(); // 'STAR' or 'AMAZON'
    table.string('source').notNullable(); // 'auto_email' or 'manual_upload'
    
    // STAR fields
    table.string('grn_no');
    table.date('grn_date');
    table.string('plant_code');
    table.string('plant_name');
    table.string('vendor_code');
    table.string('vendor_name');
    table.string('delivery_note');
    table.string('po_number');
    table.string('hsn_code');
    table.string('article_no');
    table.string('item_description');
    table.float('po_qty');
    table.float('received_qty');
    table.string('unit');
    table.float('mrp');
    table.float('cost_per_unit');

    // Amazon fields
    table.string('challan_no');
    table.date('challan_date');
    table.string('asin');
    table.float('unit_price');
    table.integer('qty');

    // Computed (stored for perf)
    table.float('total_amount');

    // Common
    table.string('pdf_filename');
    table.string('email_message_id');
    table.timestamp('entry_date').defaultTo(knex.fn.now());
    table.string('status').defaultTo('pending_review'); // 'pending_review' | 'confirmed' | 'deleted'
    table.text('notes');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('bills');
}
