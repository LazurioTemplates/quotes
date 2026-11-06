---
name: check-quote-before-sending
description: "Use before a quote goes to a customer („zkontroluj nabídku před odesláním“, „můžu to poslat?“, „připrav e-mail s nabídkou“, „check the quote before sending“): run the check, read the quote as the customer will, prepare the PDF and the e-mail text, and hand the person the exact message for approval. Sending stays the person's; marking the quote as sent comes after it went out."
---

# Check a quote before it goes out

The person wants to send a quote. Your job is to make sure it is right, to
prepare the PDF and the e-mail, and to hand them over; the person sends.
Work in `app/v3` of the Module and pass `--lang cs` or `--lang en` (your
Folder's language).

## Steps

1. **Run the check:** `bun run quotes quote:check <number> --lang <cs|en>`.
   An error stops the quote. Fix only with the person: a missing price (ask
   for it), an expired validity (ask for the new date), placeholder details of
   the Organization (they are filled in once, under Nastavení / Settings).
2. **Read it as the customer will:** `bun run quotes quote:show <number>`.
   Compare it with the inquiry in the internal note: the customer's name,
   company ID and address; the subject; every quantity and unit; discounts;
   VAT rates (goods and work 21 %, a reduced rate only where it belongs);
   the totals; the validity date; the terms.
3. **Weigh the warnings with the person.** A price that changed in the price
   list since the quote was made (keep the quoted price or take the new one),
   a sale below the purchase price, a margin under the Organization's minimum,
   a customer without an e-mail. Never change a price, a discount or a VAT rate
   on your own.
4. **The PDF:** `bun run quotes quote:print <number> --lang <cs|en>` gives the
   path of the print page. Open the App's `runtime.url` with that path in the
   Environment browser (`lazurio browser window`), check that it shows the right
   number, version and totals, and save it with `agent-browser --cdp 9222
   --session <session> pdf ~/Documents/<task>/<file>`, the file name
   `quote:email` gives.
5. **The e-mail:** `bun run quotes quote:email <number> --lang <cs|en>`. Show
   the person the exact message: the channel, the recipient, the subject, the
   full text and the attachment. Sending it is a Publication: send nothing
   yourself unless the person approves exactly that message and the
   Organization's rules let agents send. Where the Organization connected its
   mailbox as an Integration (`lazurio integrations list --json`), you may on
   their word put the message there as a draft for them to send
   (`docs/extending.md`, "Sending a quote through the Organization's
   Integration").
6. **After the person says it went out:** `bun run quotes quote:act <number>
   send` (or "Označit jako odeslanou" / "Mark as sent" in the App) locks the
   version as a draft change; the person publishes it. A later edit is a new
   version, never a change of what the customer has.

## Never

- send the quote, the PDF or the e-mail on your own;
- mark a quote as sent before it went out;
- change prices, discounts, VAT rates or the customer's details without the
  person.
