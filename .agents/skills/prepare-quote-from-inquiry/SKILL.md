---
name: prepare-quote-from-inquiry
description: "Use when a person asks for a quote from a customer's inquiry (an e-mail, a call note, a list of wishes; „připrav nabídku z poptávky“, „udělej nabídku pro…“, „prepare a quote for…“): find or add the customer, match every wish to the price list, save a draft quote with `bun run quotes quote:new`, and say what the price list lacks. It never publishes and never sends anything to the customer."
---

# Prepare a quote from an inquiry

A customer wrote what they want; the person wants a quote. Your job is a draft
quote that holds everything the price list can answer, marks plainly what it
cannot, and waits for the person. Work in `app/v3` of the Module, pass
`--lang cs` or `--lang en` (your Folder's language) to every command, and read
the Organization's section of `AGENTS.md` first: its pricing rules (a usual
discount, who may give one) override the defaults here.

## Steps

1. **Read the inquiry** and list, in the customer's words, what they want:
   each thing, how many, the unit, and any wish about price, deadline,
   delivery or assembly. Keep the original text for the internal note.
2. **The customer.** `bun run quotes customers --search "<name or company ID>"`.
   When they are not there, the input gets a new contact with only what the
   inquiry states (`name`, and `email`, `company_id`, `contact_person`,
   `phone` if given). Never guess an e-mail address or an identification
   number.
3. **Match every wish to the price list.** `bun run quotes items --search
   "<two or three words>"`; try the customer's word and a synonym. Take the item
   whose name and unit fit; when two fit, take the plainer one and name the
   other in the internal note. Never invent a code, and never change the price
   list so that a quote fits.
4. **What the price list lacks** becomes a line without `code`: its name,
   quantity and unit, and no `unit_price` unless the person or the inquiry
   gave one. Such a line is saved at zero with a note to check, and the check
   before sending stops the quote until a person fills in the price.
5. **Write the input** (format in `docs/agents.md`, "The input of
   `quote:new`") to a file in `~/Documents/<task>/`, never into a repository,
   with `internal_note` holding the inquiry in short and its date. Then run
   `bun run quotes quote:new --input <file> --lang <cs|en>`.
6. **Check it:** `bun run quotes quote:check <number> --lang <cs|en>`. Errors
   are expected while lines wait for a price; fix nothing on your own.
7. **Tell the person**, in their language: the quote's number, the total with
   and without VAT, what came from the price list, what is missing and needs
   their price or decision, anything you assumed, and where the draft is: the
   App's `runtime.url` with `#/quotes/<number>-v1`. The draft waits for them
   in "Koncept a publikování" / "Draft & publish".

## Never

- publish the draft, mark the quote as sent or send anything to the customer;
- invent a price, an item, a VAT rate, a discount or a customer's detail;
- change the price list or the settings to make a quote fit.
