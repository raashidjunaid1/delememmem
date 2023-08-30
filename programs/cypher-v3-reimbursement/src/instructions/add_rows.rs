use std::mem::size_of;

use anchor_lang::prelude::*;

use crate::state::{Row, Table};

#[derive(Accounts)]
pub struct AddRows<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub table: AccountLoader<'info, Table>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_add_rows(ctx: Context<AddRows>, rows: Vec<Row>) -> Result<()> {
    {
        let table_ai = ctx.accounts.table.to_account_info();

        let old_table_size = table_ai.data_len();
        let old_table_rent = table_ai.lamports();

        let size_for_new_rows = rows.len() * size_of::<Row>();
        let new_table_size = old_table_size + size_for_new_rows;
        let new_rent_minimum = Rent::get()?.minimum_balance(new_table_size);

        // transfer required additional rent
        anchor_lang::system_program::transfer(
            anchor_lang::context::CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: table_ai.clone(),
                },
            ),
            new_rent_minimum.saturating_sub(old_table_rent),
        )?;

        table_ai.realloc(new_table_size, false)?;
    }

    let table_ai = &mut ctx.accounts.table.to_account_info();

    for row in rows.iter() {
        Table::add_row(table_ai, row)?;
    }

    msg!("Added {} rows to table.", rows.len());

    Ok(())
}
