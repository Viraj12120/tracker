import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bills', (table) => {
    table.date('current_date');
    table.string('vendor_inv_no');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bills', (table) => {
    table.dropColumn('current_date');
    table.dropColumn('vendor_inv_no');
  });
}
