use anchor_lang::prelude::*;

use crate::state::Table;

#[derive(Accounts)]
#[instruction(table_num: u32)]
pub struct CreateTable<'info> {
    #[account(
        init,
        seeds = [b"Table".as_ref(), &table_num.to_le_bytes()],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<Table>(),
    )]
    pub table: AccountLoader<'info, Table>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_table(ctx: Context<CreateTable>, table_num: u32) -> Result<()> {
    let mut table = ctx.accounts.table.load_init()?;
    table.table_num = table_num;
    table.authority = ctx.accounts.authority.key();
    Ok(())
}
