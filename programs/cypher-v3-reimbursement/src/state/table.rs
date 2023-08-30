use std::{
    cell::{Ref, RefMut},
    mem::size_of,
};

use anchor_lang::{__private::bytemuck, prelude::*};
use static_assertions::const_assert_eq;

/// Includes anchor discriminator.
pub const TABLE_HEADER_SIZE: usize = 8 + 40;

#[account(zero_copy)]
pub struct Table {
    pub table_num: u32,
    pub num_rows: u32,

    pub authority: Pubkey,
}
const_assert_eq!(size_of::<Table>(), 4 + 4 + 32);
const_assert_eq!(size_of::<Table>() % 8, 0);

impl Table {
    pub fn get_num_rows<'a>(table_ai: &'a AccountInfo) -> Result<usize> {
        let table_loader = AccountLoader::try_from(table_ai)?;
        let table: Ref<Self> = table_loader.load()?;
        Ok(table.num_rows as usize)
    }

    pub fn increment_num_rows<'a>(table_ai: &'a AccountInfo) -> Result<()> {
        let table_loader = AccountLoader::try_from(table_ai)?;
        let mut table: RefMut<Self> = table_loader.load_mut()?;
        table.num_rows += 1;
        Ok(())
    }

    pub fn add_row<'a>(table_ai: &'a mut AccountInfo, row: &Row) -> Result<()> {
        {
            let num_rows = Table::get_num_rows(table_ai)?;
            let mut table_ai_data = table_ai.try_borrow_mut_data()?;

            let start = TABLE_HEADER_SIZE + num_rows * size_of::<Row>();
            msg!("New Row Start Offset: {}", start);

            let (_, mut row_split_data) = table_ai_data.split_at_mut(start);

            row.serialize(&mut row_split_data)?;
        }

        Self::increment_num_rows(table_ai)
    }
}

#[derive(Debug, Copy, Clone, AnchorSerialize, AnchorDeserialize)]
#[repr(C)]
pub struct Row {
    pub owner: Pubkey,
    pub balances: [u64; 16],
}
const_assert_eq!(size_of::<Row>(), 32 + 8 * 16);
const_assert_eq!(size_of::<Row>() % 8, 0);

unsafe impl bytemuck::Pod for Row {}
unsafe impl bytemuck::Zeroable for Row {}

impl Row {
    pub fn load<'a>(table_ai_data: &'a [u8], index_into_table: usize) -> Result<&'a Self> {
        require_eq!(
            (table_ai_data.len() - TABLE_HEADER_SIZE) % size_of::<Row>(),
            0
        );
        let start = TABLE_HEADER_SIZE + index_into_table * size_of::<Row>();
        let end = start + size_of::<Row>();
        Ok(bytemuck::from_bytes::<Row>(&table_ai_data[start..end]))
    }

    // Renamed to `get_row_capacity` because this will no longer return the actual number of rows during insertion.
    // This is because the `handle_add_rows` instruction handler resizes the account by the space necessary to fit all of the provided rows.
    pub fn get_row_capacity<'a>(table_ai_data: &'a [u8]) -> Result<usize> {
        require_eq!(
            (table_ai_data.len() - TABLE_HEADER_SIZE) % size_of::<Row>(),
            0
        );
        Ok((table_ai_data.len() - TABLE_HEADER_SIZE) / size_of::<Row>())
    }
}
