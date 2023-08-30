use anchor_lang::prelude::*;

use crate::state::{Group, Table};

#[derive(Accounts)]
pub struct ChangeAuthority<'info> {
    #[account(
        mut,
        has_one = authority,
        has_one = table
    )]
    pub group: AccountLoader<'info, Group>,
    #[account(
        mut,
        has_one = authority
    )]
    pub table: AccountLoader<'info, Table>,

    pub authority: Signer<'info>,
}

pub fn handle_change_authority(ctx: Context<ChangeAuthority>, new_authority: Pubkey) -> Result<()> {
    let mut group = ctx.accounts.group.load_mut()?;
    group.authority = new_authority;
    let mut table = ctx.accounts.table.load_mut()?;
    table.authority = new_authority;

    msg!("Changed group authority to {:?}", new_authority);

    Ok(())
}
