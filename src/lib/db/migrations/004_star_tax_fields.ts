import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bill_items', (table) => {
    // Tax fields for STAR
    table.float('cgst_rate');
    table.float('cgst_amt');
    table.float('sgst_rate');
    table.float('sgst_amt');
    table.float('cess_rate');
    table.float('cess_amt');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bill_items', (table) => {
    table.dropColumn('cgst_rate');
    table.dropColumn('cgst_amt');
    table.dropColumn('sgst_rate');
    table.dropColumn('sgst_amt');
    table.dropColumn('cess_rate');
    table.dropColumn('cess_amt');
  });
}
