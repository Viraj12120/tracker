import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bill_items', (table) => {
    table.float('actual_qty').nullable();
    table.float('return_qty').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bill_items', (table) => {
    table.dropColumn('actual_qty');
    table.dropColumn('return_qty');
  });
}
