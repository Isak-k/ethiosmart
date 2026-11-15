# Payment discount processing

## Implemented rules

- Discount codes are case-insensitive and must be enabled.
- Selected-user discounts match the authenticated Firebase UID or the email stored on the user's profile.
- Automatic promotions apply only when their `active` flag is true.
- Percentage discounts accept values from 0 through 100; fixed discounts are ETB amounts.
- When several discounts are eligible, only the single largest saving is applied. Discounts do not stack.
- The discount is capped at the original price, so the payable amount cannot become negative.
- Amounts are rounded to two decimal places.
- The server recalculates the discount in both the quote callable and payment submission. Client-supplied prices or discounts are not trusted.
- Each submitted payment stores the original price, discount amount, discount metadata, and final expected amount. Later price or discount changes do not modify that payment snapshot.
- Sandbox payments remain in sandbox collections; discount calculation does not change lifetime-access approval behavior.

## Current configuration limitations

The existing admin discount schema contains only:
- Codes: `code`, `kind`, `value`, `enabled`
- Promotions: `label`, `kind`, `value`, `active`
- Selected users: `identifier`, `kind`, `value`

There are no start/end date fields or per-discount usage-limit fields in the existing settings schema, so date windows and usage caps are not implemented. Add those fields through a separately versioned admin/backend change before relying on them.

## Student flow

The student payment screen requests a server-generated quote on initial load and when a discount code is applied. The server recalculates again on submission. The displayed quote is informational; the stored payment snapshot is authoritative.
