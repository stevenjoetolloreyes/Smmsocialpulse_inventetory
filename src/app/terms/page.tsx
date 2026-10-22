import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Terms of Service · Inventory Management System" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="October 2026">
      <p>
        These terms describe the basic rules for using the Inventory Management
        System (the &ldquo;system&rdquo;), a point-of-sale and inventory tool
        operated by an individual store owner for their own store.
      </p>

      <h2>Accounts</h2>
      <p>
        Anyone may submit a registration, but a new account is inactive until the
        store owner activates it. Registration never creates an owner or
        administrator account. The store owner may activate, deactivate, change the
        role of, or reset the password of any account at any time. Each person is
        responsible for keeping their own password private and for the actions
        taken while signed in to their account.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use the system only for the store&apos;s legitimate business: recording
        products, stock, purchases, and sales, and producing reports. Do not enter
        false records on purpose, try to access another store&apos;s deployment,
        attempt to bypass sign-in or account activation, or use the system in any
        way that breaks the law.
      </p>

      <h2>Store data and records</h2>
      <p>
        Products, stock levels, prices, and sales records in the system are the
        store&apos;s own business records. Figures shown in dashboards and reports
        are computed from the records entered; the store owner is responsible for
        the accuracy of what is entered and for keeping their own backups of
        anything important.
      </p>

      <h2>Availability</h2>
      <p>
        The system is provided &ldquo;as is&rdquo;, without warranties. It may be
        unavailable during maintenance, hosting outages, or internet interruptions.
        The store owner is responsible for their hosting, database, and account
        credentials with those providers.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change, the updated text will be posted on this page with a
        new &ldquo;last updated&rdquo; date. Continuing to use the system after a
        change means accepting the updated terms.
      </p>
    </LegalShell>
  );
}
