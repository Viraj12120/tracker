import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create bill_items table
  await knex.schema.createTable('bill_items', (table) => {
    table.increments('id').primary();
    table.integer('bill_id').unsigned().notNullable();
    table.foreign('bill_id').references('id').inTable('bills').onDelete('CASCADE');
    
    // Common item fields
    table.string('description');
    table.float('qty');
    table.float('unit_price');
    table.float('total_amount');
    
    // STAR specific
    table.string('hsn_code');
    table.string('article_no');
    table.float('mrp');
    table.float('cost_per_unit');
    table.string('unit');
    
    // AMAZON specific
    table.string('asin');
    
    // For smart tracking
    table.json('raw_details'); // Store any extra fields from LLM
  });

  // Add bulk delete support / index for status
  await knex.schema.alterTable('bills', (table) => {
    table.index(['status']);
    table.index(['company']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bill_items');
  await knex.schema.alterTable('bills', (table) => {
    table.dropIndex(['status']);
    table.dropIndex(['company']);
  });
}
