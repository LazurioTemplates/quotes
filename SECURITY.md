# Security

## Reporting

Report a vulnerability privately through GitHub's "Report a vulnerability"
on this repository. Do not open a public issue for it.

## What the App defends

- **Writes come only from the App itself.** Every writing API request must be
  `application/json` and carry an `Origin` of the App's own listener (loopback
  or the hosted origin Lazurio passes). A foreign `Host` is refused.
- **The App serves one data repository.** The sync host refuses a checkout
  whose configuration names another remote or branch, or whose real path lies
  outside the Module (`boundary_violation`).
- **No Git and no paths of its own on the data.** Records are read and written
  only through repository-db (`Collection`, `readDataFile`), which refuses
  symbolic links and paths outside the checkout. A save names the revision it
  was edited from; a stale save is refused. An import writes only what the
  person reviewed: the preview's token binds the request, its rows and the
  revisions of the data it was computed from, and anything changed since
  refuses the import. Every write of the App checks and writes under
  repository-db's draft write gate, so a save of another engine writer cannot
  land between a check and a write.
- **Publishing is one validated commit.** repository-db runs the data
  repository's validator before every publish. Who may publish is decided by
  the person's live GitHub rights on the data repository; the App keeps no
  roster, token or key.
- **Nothing goes to a customer.** The App and its command line prepare the
  print page, the PDF's name and the e-mail text; sending is a person's
  Publication through the Organization's own mailbox.
- **Internal figures stay inside.** The print page of a quote shows no
  purchase price, margin, internal note or line still waiting for a check.
- **No secrets.** The App declares none, reads no `.env` file and stores no
  credential. Git transport uses the Environment's own sign-in.

## Out of scope

Authorization inside the App: anyone who can open the App in an Environment
can draft changes there. Access is decided by who may use the Environment and
by GitHub rights on the data repository.
